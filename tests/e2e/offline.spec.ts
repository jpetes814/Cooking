import { expect, test } from "@playwright/test";

async function waitForServiceWorker(page: import("@playwright/test").Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((r) => navigator.serviceWorker.addEventListener("controllerchange", r, { once: true }));
    }
  });
}

test("reopens with no signal after one visit", async ({ page, context }) => {
  await page.goto("/");
  await waitForServiceWorker(page);
  await expect(page.getByTestId("status-line")).toContainText("Online");

  // Airplane mode, then a cold reopen.
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Recipe Box" })).toBeVisible();
  await expect(page.getByTestId("status-line")).toContainText("Offline");
  await page.getByRole("button", { name: "Pantry" }).click();
  await expect(page.getByRole("heading", { name: "Pantry staples" })).toBeVisible();
});
