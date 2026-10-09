import { expect, test, type Page } from "@playwright/test";
import { COOK, signIn } from "./firebase";

async function addRecipe(page: Page, name: string, ingredients: string) {
  await page.getByRole("button", { name: "+ Add recipe" }).click();
  const sheet = page.getByRole("dialog", { name: "New recipe" });
  await sheet.getByLabel("Name").fill(name);
  await sheet.getByLabel("Ingredients").fill(ingredients);
  await sheet.getByRole("button", { name: "Review recipe" }).click();
  await sheet.getByRole("button", { name: "Looks good, save" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  await page.getByRole("button", { name: "‹ All recipes" }).click();
}

test("finds recipes that use what you have, counting pantry staples, offline too", async ({ page, context }) => {
  await signIn(page, COOK);
  await page.getByRole("button", { name: "Pantry" }).click();
  await page.getByRole("button", { name: "Add salt" }).click();
  await page.getByRole("button", { name: "Recipes" }).click();

  await addRecipe(page, "Lemon chicken traybake", "4 chicken thighs\n2 lemons\n1 tsp salt\n3 sprigs rosemary");
  await addRecipe(page, "Spinach feta pie", "1 bag spinach\n1 cup feta\npuff pastry");

  await page.getByRole("button", { name: "What can I make?" }).click();
  const sheet = page.getByRole("dialog", { name: "What can I make?" });
  const results = sheet.getByRole("list", { name: "Recipes you could make" }).getByRole("listitem");

  await sheet.getByLabel("What do you have?").fill("Chicken, lemon");
  await sheet.getByRole("button", { name: "Add", exact: true }).click();
  await expect(results).toHaveCount(1);
  await expect(results.first()).toContainText("Lemon chicken traybake");
  await expect(results.first()).toContainText("uses chicken, lemon");
  // Salt is a staple, so only the rosemary is missing.
  await expect(results.first()).toContainText("missing 1: rosemary");

  await sheet.getByLabel("What do you have?").fill("spinach");
  await sheet.getByLabel("What do you have?").press("Enter");
  await expect(results).toHaveCount(2);

  // It works with no signal, and remembers what you typed.
  await context.setOffline(true);
  await sheet.getByRole("button", { name: "Remove chicken" }).click();
  await sheet.getByRole("button", { name: "Remove lemon" }).click();
  await expect(results).toHaveCount(1);
  await expect(results.first()).toContainText("Spinach feta pie");
  await expect(results.first()).toContainText("missing 2: feta, puff pastry");
  await results.first().click();
  await expect(page.getByRole("heading", { name: "Spinach feta pie" })).toBeVisible();
  await context.setOffline(false);

  await page.getByRole("button", { name: "‹ All recipes" }).click();
  await page.getByRole("button", { name: "What can I make?" }).click();
  await expect(sheet.getByRole("button", { name: "Remove spinach" })).toBeVisible();
  await sheet.getByRole("button", { name: "Clear" }).click();
  await expect(sheet.getByText("Add a few things you have")).toBeVisible();
});
