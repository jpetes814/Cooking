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

test("finds new recipes on the web and saves one after checking it", async ({ page, context }) => {
  await signIn(page, COOK);
  await page.getByRole("button", { name: "What can I make?" }).click();
  const sheet = page.getByRole("dialog", { name: "What can I make?" });
  await sheet.getByLabel("What do you have?").fill("gnocchi, tomatoes");
  await sheet.getByRole("button", { name: "Add", exact: true }).click();

  // No signal: it says so instead of failing.
  await context.setOffline(true);
  await expect(sheet.getByRole("button", { name: "Finding new recipes needs signal" })).toBeDisabled();
  await context.setOffline(false);

  await sheet.getByRole("button", { name: "Find new ones on the web" }).click();
  const found = sheet.getByRole("list", { name: "Found on the web" }).getByRole("listitem");
  // The made-up page that wasn't in the search results is dropped.
  await expect(found).toHaveCount(2);
  await expect(found.first()).toContainText("Sheet pan gnocchi");
  await expect(found.first()).toContainText("example.com");
  await expect(found.first()).toContainText("uses gnocchi, tomatoes");
  await expect(found.first().getByRole("link", { name: "Look ↗" })).toHaveAttribute("href", "https://example.com/recipes/sheet-pan-gnocchi");

  // Save starts a new recipe with the link; you fill and check it as usual.
  await found.first().getByRole("button", { name: "Save Sheet pan gnocchi" }).click();
  const editor = page.getByRole("dialog", { name: "New recipe" });
  await expect(editor.getByLabel("Name")).toHaveValue("Sheet pan gnocchi");
  await expect(editor.getByLabel("Link")).toHaveValue("https://example.com/recipes/sheet-pan-gnocchi");
  await editor.getByRole("button", { name: "Fill from link" }).click();
  await expect(editor.getByLabel("Ingredients")).toHaveValue(/cherry tomatoes/);
  await editor.getByRole("button", { name: "Review recipe" }).click();
  await editor.getByRole("button", { name: "Looks good, save" }).click();
  await expect(page.getByRole("heading", { name: "Sheet pan gnocchi" })).toBeVisible();
});

test("narrows by cooking method, time, and effort, here and on the web", async ({ page }) => {
  await signIn(page, COOK);
  await page.getByRole("button", { name: "+ Add recipe" }).click();
  const editor = page.getByRole("dialog", { name: "New recipe" });
  await editor.getByLabel("Name").fill("Air fryer chicken bites");
  await editor.getByLabel("Ingredients").fill("1 lb chicken breast\n1 tsp paprika");
  await editor.getByRole("button", { name: "Show tag ideas" }).click();
  for (const tag of ["method/air-fryer", "time/under-30-min", "effort/easy"]) {
    await editor.getByRole("button", { name: `Add tag ${tag}` }).click();
  }
  await editor.getByRole("button", { name: "Review recipe" }).click();
  await editor.getByRole("button", { name: "Looks good, save" }).click();
  await page.getByRole("button", { name: "‹ All recipes" }).click();

  await page.getByRole("button", { name: "What can I make?" }).click();
  const sheet = page.getByRole("dialog", { name: "What can I make?" });
  if (await sheet.getByRole("button", { name: "Clear" }).isVisible()) await sheet.getByRole("button", { name: "Clear" }).click();
  await sheet.getByLabel("What do you have?").fill("chicken");
  await sheet.getByRole("button", { name: "Add", exact: true }).click();
  const results = sheet.getByRole("list", { name: "Recipes you could make" }).getByRole("listitem");
  await expect(results).toHaveCount(2); // the bites, and the untagged traybake from earlier

  await sheet.getByRole("button", { name: "Cooking method, time, and effort" }).click();
  const methods = sheet.getByRole("group", { name: "How do you want to cook it?" });
  const time = sheet.getByRole("group", { name: "How long do you have?" });
  await methods.getByRole("button", { name: "air fryer" }).click();
  await expect(results).toHaveCount(1);
  await expect(results.first()).toContainText("Air fryer chicken bites");
  await time.getByRole("button", { name: "Under 30 min" }).click();
  await time.getByRole("button", { name: "Easy only" }).click();
  await expect(results).toHaveCount(1);

  await methods.getByRole("button", { name: "oven" }).click();
  await expect(sheet.getByText("None of your recipes match with these filters")).toBeVisible();

  // Remembered, and sent along with the web search.
  await page.reload();
  await page.getByRole("button", { name: "What can I make?" }).click();
  await expect(sheet.getByRole("button", { name: /Cooking method, time, and effort · on/ })).toBeVisible();
  await expect(methods.getByRole("button", { name: "oven" })).toHaveAttribute("aria-pressed", "true");
  const asked = page.waitForRequest("**/api/find-recipes");
  await sheet.getByRole("button", { name: "Find new ones on the web" }).click();
  expect((await asked).postDataJSON()).toMatchObject({ have: ["chicken"], method: "oven", maxMinutes: 30, easy: true });
  await expect(sheet.getByRole("list", { name: "Found on the web" })).toBeVisible();

  await methods.getByRole("button", { name: "Any way" }).click();
  await expect(sheet.getByText("Found for: chicken · oven · under 30 min · easy")).toBeVisible();
});
