import { expect, test, type Page } from "@playwright/test";
import { signIn, TESTER } from "./firebase";

const staple = (page: Page, name: string) => page.getByRole("button", { name: `Remove ${name}` });

test("adds, tidies, and removes staples", async ({ page }) => {
  await signIn(page, TESTER);
  await page.getByRole("button", { name: "Pantry" }).click();

  await page.getByLabel("New staple").fill("  Smoked   PAPRIKA ");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(staple(page, "smoked paprika")).toBeVisible();

  await page.getByLabel("New staple").fill("smoked paprika");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("smoked paprika is already in your pantry.")).toBeVisible();

  await page.getByRole("button", { name: "Add salt" }).click();
  await expect(staple(page, "salt")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add salt" })).toHaveCount(0);

  await staple(page, "smoked paprika").click();
  await expect(staple(page, "smoked paprika")).toHaveCount(0);

  // Still there after a reload.
  await page.reload();
  await page.getByRole("button", { name: "Pantry" }).click();
  await expect(staple(page, "salt")).toBeVisible();
});
