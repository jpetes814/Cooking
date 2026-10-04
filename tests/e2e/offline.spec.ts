import { expect, test } from "@playwright/test";
import { signIn, TESTER } from "./firebase";

async function waitForServiceWorker(page: import("@playwright/test").Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((r) => navigator.serviceWorker.addEventListener("controllerchange", r, { once: true }));
    }
  });
}

test("reopens with no signal, keeps staples, and syncs changes made offline", async ({ page, context }) => {
  await signIn(page, TESTER);
  await waitForServiceWorker(page);
  await page.getByRole("button", { name: "Pantry" }).click();
  const staple = (name: string) => page.getByRole("button", { name: `Remove ${name}` });

  await page.getByLabel("New staple").fill("honey");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(staple("honey")).toBeVisible();
  // Wait for the server to confirm it before cutting the signal.
  await expect(page.getByTestId("status-line")).toContainText("Synced");

  // Airplane mode, then a cold reopen: still signed in, staples still there.
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId("status-line")).toContainText("Offline");
  await page.getByRole("button", { name: "Pantry" }).click();
  await expect(staple("honey")).toBeVisible();

  // A staple added with no signal is saved on the phone and marked as waiting.
  await page.getByLabel("New staple").fill("maple syrup");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(staple("maple syrup")).toBeVisible();
  await expect(page.getByText("waiting to sync").first()).toBeVisible();
  await expect(page.getByTestId("status-line")).toContainText("1 waiting to sync");

  // Back in signal: it goes up on its own.
  await context.setOffline(false);
  await expect(page.getByTestId("status-line")).toContainText("Synced");
  await expect(page.getByText("waiting to sync")).toHaveCount(0);
});
