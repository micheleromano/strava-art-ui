import { expect, test } from "@playwright/test";

const STUDIO = "/studio?source=sample&from=2026-09-01&to=2026-09-30";

test.describe("on Windows", () => {
  test.use({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  });

  test("after downloading a PNG, people are told how to make it their wallpaper", async ({
    page,
  }) => {
    await page.goto(STUDIO);
    // A desktop browser that can't share files doesn't offer it.
    await expect(
      page.getByRole("button", { name: "Share or save to Photos" }),
    ).toBeHidden();

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download PNG" }).click();
    await download;
    await expect(page.getByText("Use it as your wallpaper")).toBeVisible();
    await expect(
      page.getByText(
        "Open your Downloads folder, right-click it and choose Set as desktop background.",
      ),
    ).toBeVisible();
  });
});

test.describe("on an iPhone", () => {
  test.use({
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    hasTouch: true,
  });

  // Headless Chrome has no share menu, so this stands in for the phone's. Playwright copies
  // it into the page as source text, so `outcome` must be passed in, not captured.
  function fakeShareMenu(outcome: string) {
    Object.assign(navigator, {
      canShare: () => true,
      share: async (data: { files: File[] }) => {
        (window as unknown as { shared: string[] }).shared = data.files.map(
          (file) => `${file.name} ${file.type}`,
        );
        if (outcome === "cancel") {
          throw new DOMException("Share cancelled", "AbortError");
        }
      },
    });
  }

  test("people can send the PNG to the share menu, then see how to set it as wallpaper", async ({
    page,
  }) => {
    await page.addInitScript(fakeShareMenu, "share");
    await page.goto(STUDIO);
    await page.getByRole("button", { name: "Share or save to Photos" }).click();
    await expect(
      page.getByText(
        /Open it in Photos, tap the Share button and choose Use as Wallpaper/,
      ),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => (window as unknown as { shared: string[] }).shared,
      ),
    ).toEqual(["strava-art.png image/png"]);
  });

  test("closing the share menu without choosing anything shows nothing", async ({
    page,
  }) => {
    await page.addInitScript(fakeShareMenu, "cancel");
    await page.goto(STUDIO);
    await page.getByRole("button", { name: "Share or save to Photos" }).click();
    await expect(
      page.getByRole("button", { name: "Share or save to Photos" }),
    ).toBeEnabled();
    await expect(page.getByText("Use it as your wallpaper")).toBeHidden();
    await expect(
      page.getByText("We couldn't open the share menu"),
    ).toBeHidden();
  });
});
