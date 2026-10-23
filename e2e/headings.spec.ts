import { expect, test, type Page } from "@playwright/test";

// Screen reader users navigate by headings, so levels must start at 1 and never skip one.
async function headingLevels(page: Page) {
  return page
    .locator("h1, h2, h3, h4, h5, h6")
    .evaluateAll((headings) =>
      headings.map((heading) => Number(heading.tagName[1])),
    );
}

function expectNoSkippedLevels(levels: number[]) {
  expect(levels[0]).toBe(1);
  levels.slice(1).forEach((level, index) => {
    expect(level - levels[index]).toBeLessThanOrEqual(1);
  });
}

test("the home page's headings don't skip levels", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expectNoSkippedLevels(await headingLevels(page));
});

test("the studio's headings don't skip levels, with the route list open", async ({
  page,
}) => {
  await page.goto("/studio?source=sample&from=2026-09-01&to=2026-09-30");
  await page.getByRole("button", { name: /Choose and rotate routes/ }).click();
  expectNoSkippedLevels(await headingLevels(page));
});

test("pages credit Strava with its official logo, and the Connect button is Strava's own", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page
      .getByRole("contentinfo")
      .getByRole("img", { name: "Powered by Strava" }),
  ).toBeVisible();
  const connect = page.getByRole("button", { name: "Connect with Strava" });
  await expect(connect.getByRole("img")).toHaveAttribute(
    "src",
    "/strava/btn_strava_connect_with_orange.svg",
  );
  // The app's own name is the most prominent thing on the page, not Strava's.
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Route Art");
});
