import { expect, test, type Page } from "@playwright/test";
import { signIn, TESTER } from "./firebase";

// A small made-up image: 40x30 pixels, solid green.
async function samplePhoto(page: Page): Promise<Buffer> {
  const base64 = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 40;
    c.height = 30;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#2f7a4f";
    ctx.fillRect(0, 0, 40, 30);
    return c.toDataURL("image/png").split(",")[1];
  });
  return Buffer.from(base64, "base64");
}

async function addRecipeWithPhoto(page: Page, name: string) {
  const buffer = await samplePhoto(page);
  await page.getByRole("button", { name: "+ Add recipe" }).click();
  const sheet = page.getByRole("dialog", { name: "New recipe" });
  await sheet.getByLabel("Name").fill(name);
  await sheet.getByLabel("Add photos").setInputFiles({ name: "dish.png", mimeType: "image/png", buffer });
  await expect(sheet.getByRole("img", { name: "New photo" })).toBeVisible();
  await sheet.getByRole("button", { name: "Review recipe" }).click();
  await sheet.getByRole("button", { name: "Looks good, save" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
}

const uploaded = /^http:\/\/127\.0\.0\.1:9199\/v0\/b\//;

test("adds a photo, shows it, opens it full screen, and removes it", async ({ page }) => {
  await signIn(page, TESTER);
  await addRecipeWithPhoto(page, "Photo soup");

  const cover = page.getByRole("button", { name: "Open photo 1" }).getByRole("img");
  // Uploads, then shows from Firebase Storage.
  await expect(cover).toHaveAttribute("src", uploaded);
  await expect(page.getByTestId("status-line")).toContainText("Synced");

  await page.getByRole("button", { name: "Open photo 1" }).click();
  const viewer = page.getByRole("dialog", { name: "Photo" });
  await expect(viewer.getByRole("img")).toBeVisible();
  await viewer.getByRole("button", { name: "Close" }).click();

  await page.getByRole("button", { name: "‹ All recipes" }).click();
  await expect(page.getByRole("button", { name: /Photo soup/ })).toContainText("1 photo");

  await page.getByRole("button", { name: /Photo soup/ }).click();
  await page.getByRole("button", { name: "Edit" }).click();
  const sheet = page.getByRole("dialog", { name: "Edit recipe" });
  await sheet.getByRole("button", { name: "Remove photo 1" }).click();
  await sheet.getByRole("button", { name: "Review changes" }).click();
  await sheet.getByRole("button", { name: "Looks good, save" }).click();
  await expect(page.getByRole("button", { name: "Open photo 1" })).toHaveCount(0);
});

test("a photo added with no signal shows right away and uploads later", async ({ page, context }) => {
  await signIn(page, TESTER);
  await expect(page.getByTestId("status-line")).toContainText("Synced");

  await context.setOffline(true);
  await addRecipeWithPhoto(page, "Offline stew");
  const cover = page.getByRole("button", { name: "Open photo 1" }).getByRole("img");
  // Shown from the phone's own copy while it waits.
  await expect(cover).toHaveAttribute("src", /^blob:/);
  await expect(page.getByTestId("status-line")).toContainText("waiting to sync");

  await context.setOffline(false);
  await expect(cover).toHaveAttribute("src", uploaded, { timeout: 20_000 });
  await expect(page.getByTestId("status-line")).toContainText("Synced");
});

test("an uploaded photo still shows after reopening with no signal", async ({ page, context }) => {
  await signIn(page, TESTER);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((r) => navigator.serviceWorker.addEventListener("controllerchange", r, { once: true }));
    }
  });
  await addRecipeWithPhoto(page, "Cached casserole");
  const cover = page.getByRole("button", { name: "Open photo 1" }).getByRole("img");
  await expect(cover).toHaveAttribute("src", uploaded);
  await expect.poll(() => cover.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);

  await context.setOffline(true);
  await page.reload();
  await page.getByRole("button", { name: /Cached casserole/ }).click();
  const offlineCover = page.getByRole("button", { name: "Open photo 1" }).getByRole("img");
  await expect.poll(() => offlineCover.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBeGreaterThan(0);
});
