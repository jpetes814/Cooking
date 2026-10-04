import { expect, test, type Page } from "@playwright/test";
import { signIn, TESTER } from "./firebase";

async function openEditorWithLink(page: Page, link: string) {
  await signIn(page, TESTER);
  await page.getByRole("button", { name: "+ Add recipe" }).click();
  const sheet = page.getByRole("dialog", { name: "New recipe" });
  await sheet.getByLabel("Link").fill(link);
  return sheet;
}

test("fills a recipe page exactly, then saves it", async ({ page }) => {
  const sheet = await openEditorWithLink(page, "https://example.com/recipes/sheet-pan-gnocchi");
  await sheet.getByRole("button", { name: "Fill from link" }).click();
  await expect(sheet.getByRole("status")).toHaveText("Filled in from the recipe page.");
  await expect(sheet.getByLabel("Name")).toHaveValue("Sheet pan gnocchi");
  await expect(sheet.getByLabel("Servings")).toHaveValue("4");
  await expect(sheet.getByLabel("Ingredients")).toHaveValue(
    "1 lb shelf-stable gnocchi\n1 pint cherry tomatoes\n2 Tbsp olive oil\n1/2 tsp salt"
  );
  await expect(sheet.getByLabel("Steps")).toHaveValue("Heat the oven to 425°F.\nToss everything on a sheet pan.\nRoast 20 minutes.");

  await sheet.getByRole("button", { name: "Save recipe" }).click();
  await expect(page.getByRole("heading", { name: "Sheet pan gnocchi" })).toBeVisible();
  await expect(page.getByText("1/2 tsp")).toBeVisible();
});

test("Claude reads a TikTok caption into a draft, keeping what you typed", async ({ page }) => {
  const sheet = await openEditorWithLink(page, "https://www.tiktok.com/@somecook/video/123");
  await sheet.getByLabel("Name").fill("Weeknight lemon pasta");
  await sheet.getByRole("button", { name: "Fill from link" }).click();
  await expect(sheet.getByRole("status")).toContainText("Claude read it");
  await expect(sheet.getByLabel("Name")).toHaveValue("Weeknight lemon pasta");
  await expect(sheet.getByLabel("Ingredients")).toHaveValue(/200 g spaghetti/);
  await expect(sheet.getByLabel("Notes")).toHaveValue("Add chili flakes if you like heat.");
});

test("explains captions with no recipe, and Instagram", async ({ page }) => {
  const sheet = await openEditorWithLink(page, "https://www.tiktok.com/@somecook/video/0");
  await sheet.getByRole("button", { name: "Fill from link" }).click();
  await expect(sheet.getByRole("status")).toContainText("doesn't have the recipe in it");
  await expect(sheet.getByLabel("Ingredients")).toHaveValue("");

  await sheet.getByLabel("Link").fill("https://www.instagram.com/reel/abc/");
  await sheet.getByRole("button", { name: "Fill from link" }).click();
  await expect(sheet.getByRole("status")).toContainText("Instagram doesn't share captions");
});

test("says it needs signal when offline", async ({ page, context }) => {
  const sheet = await openEditorWithLink(page, "https://example.com/recipes/x");
  await context.setOffline(true);
  await expect(sheet.getByRole("button", { name: "Fill from link needs signal" })).toBeDisabled();
  await context.setOffline(false);
  await expect(sheet.getByRole("button", { name: "Fill from link" })).toBeEnabled();
});
