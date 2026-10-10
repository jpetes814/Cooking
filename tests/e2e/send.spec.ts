import { expect, test } from "@playwright/test";
import { signIn, TESTER } from "./firebase";

test("a link sent to the app opens a new recipe and fills it in", async ({ page }) => {
  await signIn(page, TESTER);
  await page.goto("/?add=" + encodeURIComponent("https://example.com/recipes/sheet-pan-gnocchi"));
  const sheet = page.getByRole("dialog", { name: "New recipe" });
  await expect(sheet.getByLabel("Link")).toHaveValue("https://example.com/recipes/sheet-pan-gnocchi");
  await expect(sheet.getByRole("status")).toContainText("Filled in from the recipe page.");
  await expect(sheet.getByLabel("Name")).toHaveValue("Sheet pan gnocchi");
  // Still checked before saving, and the address is tidied so a reload doesn't start another.
  await expect(page).toHaveURL(/\/$/);
  await sheet.getByRole("button", { name: "Close" }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: "Paste link" })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "New recipe" })).toHaveCount(0);
});

test("Android's share menu hands over a caption with the link inside", async ({ page }) => {
  await signIn(page, TESTER);
  await page.goto("/?title=Dinner&text=" + encodeURIComponent("So good 🍝 https://example.com/recipes/sheet-pan-gnocchi"));
  await expect(page.getByRole("dialog", { name: "New recipe" }).getByLabel("Link")).toHaveValue(
    "https://example.com/recipes/sheet-pan-gnocchi"
  );
});

test("Paste link starts a recipe from what you copied", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await signIn(page, TESTER);

  await page.evaluate(() => navigator.clipboard.writeText("just some words"));
  await page.getByRole("button", { name: "Paste link" }).click();
  await expect(page.getByRole("status")).toContainText("Copy a link first");

  await page.evaluate(() => navigator.clipboard.writeText("Check this out https://example.com/recipes/sheet-pan-gnocchi"));
  await page.getByRole("button", { name: "Paste link" }).click();
  const sheet = page.getByRole("dialog", { name: "New recipe" });
  await expect(sheet.getByLabel("Name")).toHaveValue("Sheet pan gnocchi");
  await expect(sheet.getByLabel("Ingredients")).toHaveValue(/gnocchi/);
  await sheet.getByRole("button", { name: "Review recipe" }).click();
  await sheet.getByRole("button", { name: "Looks good, save" }).click();
  await expect(page.getByRole("heading", { name: "Sheet pan gnocchi" })).toBeVisible();
});
