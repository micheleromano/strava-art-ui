import { expect, test } from "@playwright/test";

test("someone can connect Strava, see their routes, and disconnect", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByText("We keep only each activity's date and route line"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Connect with Strava" }).click();

  await expect(page).toHaveURL(/\/studio$/);
  await page.goto("/studio?from=2026-09-01&to=2026-09-30");
  await expect(page.getByText("3 activities shown.")).toBeVisible();
  await expect(page.getByText("Sample routes", { exact: true })).toBeHidden();

  await page.getByRole("button", { name: "Disconnect Strava" }).click();
  await expect(
    page.getByRole("button", { name: "Connect with Strava" }),
  ).toBeVisible();
  const stored = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const open = indexedDB.open("keyval-store");
        open.onsuccess = () => {
          const count = open.result
            .transaction("keyval")
            .objectStore("keyval")
            .count();
          count.onsuccess = () => resolve(count.result);
        };
      }),
  );
  expect(stored).toBe(0);
});
