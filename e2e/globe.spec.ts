import { expect, test, type Page } from "@playwright/test";

// The mock Strava's fixture routes are all around Paris in September 2026.
const GLOBE = "/studio?layout=globe&from=2026-09-01&to=2026-09-30";

async function connect(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Connect with Strava" }).click();
  await expect(page).toHaveURL(/\/studio$/);
}

/** Reads one pixel of a downloaded PNG in the browser, which can decode images. */
async function cornerPixel(page: Page, png: Buffer) {
  return page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    const bitmap = await createImageBitmap(
      new Blob([bytes], { type: "image/png" }),
    );
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext("2d")!;
    context.drawImage(bitmap, 0, 0);
    return {
      width: bitmap.width,
      height: bitmap.height,
      rgba: [...context.getImageData(0, 0, 1, 1).data],
    };
  }, png.toString("base64"));
}

async function downloadPng(page: Page) {
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PNG" }).click();
  const stream = await (await download).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

test("visitors see the creator's sample routes as areas on a globe", async ({
  page,
}) => {
  await page.goto(
    "/studio?source=sample&layout=globe&from=2026-09-01&to=2026-09-30",
  );
  await expect(page.getByRole("radio", { name: "Globe" })).toBeEnabled();
  // The fixture's five routes are all around Hyde Park: one area.
  await expect(page.getByText("1 area, from 5 routes.")).toBeVisible();
  await expect(
    page.getByRole("img", {
      name: /A globe with 1 dot, for the area of 5 routes/,
    }),
  ).toBeVisible();
  await expect(
    page.getByText(/on the globe each one shows only as an area/),
  ).toBeVisible();
});

test("people's own routes show on a globe as rounded areas, and download with a transparent background", async ({
  page,
}) => {
  await connect(page);
  await page.goto(GLOBE);
  // Three routes close together in Paris round to one area.
  await expect(page.getByText("1 area, from 3 routes.")).toBeVisible();
  await expect(
    page.getByRole("img", {
      name: /A globe with 1 dot, for the area of 3 routes/,
    }),
  ).toBeVisible();
  // Line-only controls are hidden for the globe.
  await expect(page.getByRole("button", { name: "Download SVG" })).toBeHidden();
  await expect(
    page.getByRole("slider", { name: "Line thickness" }),
  ).toBeHidden();

  const transparent = page.getByRole("checkbox", {
    name: /Transparent background/,
  });
  await expect(transparent).toBeChecked();
  const clear = await cornerPixel(page, await downloadPng(page));
  // Square, at the size the globe is drawn on screen.
  const drawn = await page
    .getByRole("img", { name: /A globe with/ })
    .evaluate((canvas) => (canvas as HTMLCanvasElement).width);
  expect([clear.width, clear.height]).toEqual([drawn, drawn]);
  expect(drawn).toBeGreaterThanOrEqual(500);
  expect(clear.rgba[3]).toBe(0);

  // Unticked, the background colour fills in behind the globe (Midnight: #0f172a).
  await page.getByText(/Transparent background/).click();
  const filled = await cornerPixel(page, await downloadPng(page));
  expect(filled.rgba).toEqual([0x0f, 0x17, 0x2a, 255]);
});

test.describe("for someone who prefers reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("the globe starts still, and can be set spinning", async ({ page }) => {
    await connect(page);
    await page.goto(GLOBE);
    const spin = page.getByRole("button", { name: "Spin the globe" });
    await expect(spin).toBeVisible();
    await spin.click();
    await expect(
      page.getByRole("button", { name: "Pause spinning" }),
    ).toBeVisible();
  });

  // Paused by reduced motion, so only the tilt can change the drawing.
  test("the tilt slider turns the globe north or south", async ({ page }) => {
    await connect(page);
    await page.goto(GLOBE);
    // Paris is at about 48.9° N, so the globe starts tilted half way toward it.
    const tilt = page.getByRole("slider", { name: "Tilt" });
    await expect(tilt).toHaveValue("24");

    const canvas = page.getByRole("img", { name: /A globe with/ });
    const drawing = () =>
      canvas.evaluate((el) => (el as HTMLCanvasElement).toDataURL());
    const before = await drawing();
    await tilt.focus();
    await page.keyboard.press("Home"); // All the way south.
    await expect(tilt).toHaveValue("-90");
    await expect.poll(drawing).not.toBe(before);
  });
});

test.describe("where the browser can share files", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      Object.assign(navigator, { canShare: () => true, share: async () => {} });
    });
  });

  test("the sharing note describes what the globe shows, not route shapes", async ({
    page,
  }) => {
    await connect(page);
    await page.goto(GLOBE);
    await expect(
      page.getByText(
        "Anyone you send the picture to can see the areas you've been active in, rounded to about 25 km.",
      ),
    ).toBeVisible();
    await expect(
      page.getByText(/can see the shapes of your routes/),
    ).toBeHidden();

    await page.getByRole("radio", { name: "End to end" }).click();
    await expect(
      page.getByText(/can see the shapes of your routes/),
    ).toBeVisible();
  });
});
