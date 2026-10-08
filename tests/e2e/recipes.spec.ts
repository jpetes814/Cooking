import { expect, test, type Page } from "@playwright/test";
import { signIn, TESTER } from "./firebase";

async function addRecipe(page: Page, fields: { name: string; link?: string; ingredients?: string; steps?: string }) {
  await page.getByRole("button", { name: "+ Add recipe" }).click();
  const sheet = page.getByRole("dialog", { name: "New recipe" });
  await sheet.getByLabel("Name").fill(fields.name);
  if (fields.link) await sheet.getByLabel("Link").fill(fields.link);
  if (fields.ingredients) await sheet.getByLabel("Ingredients").fill(fields.ingredients);
  if (fields.steps) await sheet.getByLabel("Steps").fill(fields.steps);
  await sheet.getByRole("button", { name: "Review recipe" }).click();
  await sheet.getByRole("button", { name: "Looks good, save" }).click();
}

test("adds, views, edits, and deletes a recipe", async ({ page }) => {
  await signIn(page, TESTER);

  // The name is the only must.
  await page.getByRole("button", { name: "+ Add recipe" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Review recipe" }).click();
  await expect(page.getByText("Give it a name.")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();

  await addRecipe(page, {
    name: "Weeknight tomato soup",
    ingredients: "- 2 Tbsp olive oil\n1 1/2 cups diced onion\nsalt to taste",
    steps: "1. Soften the onion\n2. Simmer 20 minutes",
  });

  // Saving opens the recipe.
  await expect(page.getByRole("heading", { name: "Weeknight tomato soup" })).toBeVisible();
  await expect(page.getByText("1 1/2 cups")).toBeVisible();
  await expect(page.getByText("salt to taste")).toBeVisible();
  await expect(page.getByText("Simmer 20 minutes")).toBeVisible();

  await page.getByRole("button", { name: "Edit" }).click();
  const sheet = page.getByRole("dialog", { name: "Edit recipe" });
  await expect(sheet.getByLabel("Ingredients")).toHaveValue("2 Tbsp olive oil\n1 1/2 cups diced onion\nsalt to taste");
  await sheet.getByLabel("Name").fill("Roasted tomato soup");
  await sheet.getByRole("button", { name: "Review changes" }).click();
  await sheet.getByRole("button", { name: "Looks good, save" }).click();
  await expect(page.getByRole("heading", { name: "Roasted tomato soup" })).toBeVisible();

  await page.getByRole("button", { name: "‹ All recipes" }).click();
  await expect(page.getByRole("button", { name: /Roasted tomato soup/ })).toContainText("3 ingredients");

  await page.getByRole("button", { name: /Roasted tomato soup/ }).click();
  await page.getByRole("button", { name: "Delete recipe" }).click();
  await page.getByRole("button", { name: "Yes, delete" }).click();
  await expect(page.getByRole("button", { name: /Roasted tomato soup/ })).toHaveCount(0);
});

test("saves a video link with just a name", async ({ page }) => {
  await signIn(page, TESTER);
  await addRecipe(page, { name: "Viral feta pasta", link: "tiktok.com/@somecook/video/123" });
  const watch = page.getByRole("link", { name: "Watch on TikTok ↗" });
  await expect(watch).toHaveAttribute("href", "https://tiktok.com/@somecook/video/123");
  await expect(page.getByText("Just the link for now.")).toBeVisible();
  await page.getByRole("button", { name: "‹ All recipes" }).click();
  await expect(page.getByRole("button", { name: /Viral feta pasta/ })).toContainText("TikTok");
});

test("a recipe added offline waits, then syncs", async ({ page, context }) => {
  await signIn(page, TESTER);
  await expect(page.getByTestId("status-line")).toContainText("Synced");

  await context.setOffline(true);
  await addRecipe(page, { name: "Campfire chili", ingredients: "1 can beans" });
  await expect(page.getByRole("heading", { name: "Campfire chili" })).toBeVisible();
  await expect(page.getByText("Saved on this phone, waiting to sync")).toBeVisible();
  await expect(page.getByTestId("status-line")).toContainText("1 waiting to sync");

  await context.setOffline(false);
  await expect(page.getByTestId("status-line")).toContainText("Synced");
  await expect(page.getByText("waiting to sync")).toHaveCount(0);
});
