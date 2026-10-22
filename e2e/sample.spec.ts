import { expect, test } from "@playwright/test";

// The fixture sample activities are all in September 2026.
const SEPTEMBER = "from=2026-09-01&to=2026-09-30";

test("someone without Strava can make and download art from the sample routes", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Use sample routes" }).click();
  await expect(page.getByText("Sample routes", { exact: true })).toBeVisible();

  await page.goto(`/studio?source=sample&${SEPTEMBER}`);
  await expect(page.getByText("5 activities shown.")).toBeVisible();
  await expect(
    page.getByText("1 activity in these dates has no map"),
  ).toBeVisible();
  await expect(
    page.getByRole("img", {
      name: /^5 routes drawn from the same starting point/,
    }),
  ).toBeVisible();

  const png = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PNG" }).click();
  expect((await png).suggestedFilename()).toBe("route-art.png");

  const svg = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download SVG" }).click();
  expect((await svg).suggestedFilename()).toBe("route-art.svg");
});

test("the sample opens on dates that have routes, even once it's out of date", async ({
  page,
}) => {
  // The fixture is from September 2026, so "the last 30 days" may well be empty.
  await page.goto("/studio?source=sample");
  await expect(page.getByText("5 activities shown.")).toBeVisible();
});

test("dates with no activities say so instead of showing an empty picture", async ({
  page,
}) => {
  await page.goto("/studio?source=sample&from=2020-01-01&to=2020-01-31");
  await expect(
    page.getByText("No routes in these dates. Try a wider range."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Download PNG" }),
  ).toBeDisabled();
});

test("each layout draws the routes and downloads what's on screen", async ({
  page,
}) => {
  await page.goto(`/studio?source=sample&${SEPTEMBER}`);

  await page.getByRole("radio", { name: "Grid" }).click();
  await expect(
    page.getByRole("img", {
      name: "5 routes drawn in a grid, one per square.",
    }),
  ).toBeVisible();
  await page.goto(
    `/studio?source=sample&${SEPTEMBER}&layout=grid&columns=2&rows=2`,
  );
  await expect(
    page.getByText("Showing the latest 4 of 5 routes in these dates."),
  ).toBeVisible();

  await page.getByRole("radio", { name: "Paper" }).click();
  const svg = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download SVG" }).click();
  const markup = await (await svg).createReadStream().then(
    (stream) =>
      new Promise<string>((resolve) => {
        let text = "";
        stream.on("data", (chunk) => (text += chunk));
        stream.on("end", () => resolve(text));
      }),
  );
  expect(markup).toContain('fill="#f5f0e6"');
  expect(markup.match(/<path /g)).toHaveLength(4);
});

test("someone can rotate a route, and leave routes out of the picture", async ({
  page,
}) => {
  await page.goto(`/studio?source=sample&${SEPTEMBER}&layout=grid`);
  const art = page.getByRole("img", { name: /drawn in a grid/ });
  const firstPath = () => art.locator("path").first().getAttribute("d");
  const before = await firstPath();

  await page
    .getByRole("button", { name: "Choose and rotate routes (5)" })
    .click();
  const list = page.getByRole("list", {
    name: "Routes in these dates, newest first",
  });
  await list
    .getByRole("button", { name: /^Rotate the route from/ })
    .first()
    .click();
  const angle = page.getByRole("slider", {
    name: /Rotation for the route from/,
  });
  await angle.focus();
  for (let i = 0; i < 90; i++) await angle.press("ArrowRight");
  await expect(page.getByText("Turned 90°")).toBeVisible();
  expect(await firstPath()).not.toBe(before);

  // Click the visible label, as a person would; the real input is visually hidden.
  const second = list.getByRole("listitem").nth(1);
  await second.locator("label").click();
  await expect(second.getByRole("checkbox")).not.toBeChecked();
  await expect(page.getByText("You've hidden 1 route.")).toBeVisible();
  await expect(art.locator("path")).toHaveCount(4);

  // Keyboard focus stays on the button after pressing it.
  const hideAll = page.getByRole("button", { name: "Hide all" });
  await hideAll.focus();
  await page.keyboard.press("Enter");
  await expect(hideAll).toBeFocused();
  await expect(
    page.getByText("You've hidden every route in these dates."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Show all" }).click();
  await expect(page.getByText("5 activities shown.")).toBeVisible();
});

test("routes can be joined end to end", async ({ page }) => {
  await page.goto(`/studio?source=sample&${SEPTEMBER}`);
  await page.getByRole("radio", { name: "End to end" }).click();
  await expect(
    page.getByRole("img", { name: /^5 routes joined end to end/ }),
  ).toBeVisible();
  await expect(page.getByRole("slider", { name: "Zoom" })).toBeVisible();
});

test.describe("on a 1600 × 900 screen", () => {
  test.use({
    screen: { width: 1600, height: 900 },
    viewport: { width: 1280, height: 800 },
  });

  test("the picture can match the screen's shape, for a wallpaper", async ({
    page,
  }) => {
    await page.goto(`/studio?source=sample&${SEPTEMBER}`);
    const art = page.getByRole("img", { name: /same starting point/ });
    await expect(art).toHaveAttribute("viewBox", "0 0 1000 1000");

    await page.getByText("Fit my screen, for a wallpaper").click();
    await expect(
      page.getByText("The PNG will be 1600 × 900 pixels."),
    ).toBeVisible();
    await expect(art).toHaveAttribute("viewBox", "0 0 1778 1000");

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download PNG" }).click();
    const png = await (await download).createReadStream().then(
      (stream) =>
        new Promise<Buffer>((resolve) => {
          const chunks: Buffer[] = [];
          stream.on("data", (chunk: Buffer) => chunks.push(chunk));
          stream.on("end", () => resolve(Buffer.concat(chunks)));
        }),
    );
    // A PNG's width and height are stored at bytes 16–23.
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1600, 900]);
  });
});
