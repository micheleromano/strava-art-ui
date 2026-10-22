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
      page.getByRole("button", { name: "Share or save picture" }),
    ).toBeHidden();

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download PNG" }).click();
    await download;
    await expect(page.getByText("Download started")).toBeVisible();
    await expect(
      page.getByText(
        /open your Downloads folder, right-click it .* Set as desktop background/,
      ),
    ).toBeVisible();
    // The picture is square, so people are told how to get one that fits.
    await expect(page.getByText(/Tick Fit my screen/)).toBeVisible();
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
    const page = window as unknown as { shared?: string[]; tried?: boolean };
    Object.assign(navigator, {
      canShare: () => true,
      share: async (data: { files: File[] }) => {
        if (outcome === "cancel") {
          throw new DOMException("Share cancelled", "AbortError");
        }
        // Like a phone that only shares straight after a tap, when the first tap took too long.
        if (outcome === "slow" && !page.tried) {
          page.tried = true;
          throw new DOMException("Not right after a tap", "NotAllowedError");
        }
        page.shared = data.files.map((file) => `${file.name} ${file.type}`);
      },
    });
  }
  const shared = (page: import("@playwright/test").Page) =>
    page.evaluate(() => (window as unknown as { shared?: string[] }).shared);

  test("people can send the PNG to the share menu, then see how to set it as wallpaper", async ({
    page,
  }) => {
    await page.addInitScript(fakeShareMenu, "share");
    await page.goto(STUDIO);
    await expect(
      page.getByText("Anyone you send the picture to can see the shapes"),
    ).toBeHidden(); // Sample routes aren't the viewer's own.
    await page.getByRole("button", { name: "Share or save picture" }).click();
    await expect(page.getByText("Shared", { exact: true })).toBeVisible();
    await expect(
      page.getByText(/If you saved it to Photos, open it there, tap Share/),
    ).toBeVisible();
    expect(await shared(page)).toEqual(["route-art.png image/png"]);
  });

  test("closing the share menu without choosing anything shows nothing", async ({
    page,
  }) => {
    await page.addInitScript(fakeShareMenu, "cancel");
    await page.goto(STUDIO);
    const share = page.getByRole("button", { name: "Share or save picture" });
    await share.click();
    await expect(share).toBeEnabled();
    await expect(page.getByText("Shared", { exact: true })).toBeHidden();
    await expect(
      page.getByText("We couldn't open the share menu"),
    ).toBeHidden();
  });

  test("if the share menu won't open in time, the picture is kept ready for a second tap", async ({
    page,
  }) => {
    await page.addInitScript(fakeShareMenu, "slow");
    await page.goto(STUDIO);
    const share = page.getByRole("button", { name: "Share or save picture" });
    await share.click();
    await expect(
      page.getByText(/Your picture is ready. Tap Share or save picture again/),
    ).toBeVisible();
    await share.click();
    await expect(page.getByText("Shared", { exact: true })).toBeVisible();
    expect(await shared(page)).toEqual(["route-art.png image/png"]);
  });
});
