import { expect, test, type Page } from "@playwright/test";
import { SHOPPER, signIn } from "./firebase";

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

test("plans a trip, adds up ingredients by aisle, and checks things off offline", async ({ page, context }) => {
  await signIn(page, SHOPPER);
  await addRecipe(page, "Lemon pasta", "200 g spaghetti\n2 lemons\n3 cloves garlic, sliced\n2 tbsp olive oil\nsalt to taste");
  await addRecipe(page, "Lemon chicken", "4 chicken thighs\n1 lemon\n2 cloves garlic\n1 tbsp olive oil");
  await page.getByRole("button", { name: "Pantry" }).click();
  await page.getByRole("button", { name: "Add salt" }).click();

  await page.getByRole("button", { name: "Shop" }).click();
  await page.getByRole("button", { name: "+ New trip" }).click();
  const picker = page.getByRole("dialog", { name: "New trip" });
  await picker.getByLabel("Name").fill("Weekend shop");
  await picker.getByRole("checkbox", { name: /Lemon pasta/ }).click();
  await picker.getByRole("checkbox", { name: /Lemon chicken/ }).click();
  await picker.getByRole("button", { name: "Make a list for 2 recipes" }).click();

  await expect(page.getByRole("heading", { name: "Weekend shop" })).toBeVisible();
  const produce = page.getByRole("region", { name: "Produce" });
  await expect(produce.getByRole("checkbox", { name: "lemons" })).toContainText("3 lemons");
  await expect(produce.getByRole("checkbox", { name: "garlic" })).toContainText("5 cloves garlic");
  await expect(produce.getByRole("checkbox", { name: "garlic" })).toContainText("Lemon pasta · Lemon chicken");
  await expect(page.getByRole("region", { name: "Spices & oils" })).toContainText("3 tbsp olive oil");
  await expect(page.getByRole("region", { name: "Meat & fish" })).toContainText("4 chicken thighs");
  // Salt is a staple, so it's set aside.
  await expect(page.getByRole("region", { name: "Probably at home" })).toContainText("salt");
  const progress = page.getByTestId("trip-progress");
  await expect(progress).toHaveText("5 to get · 0 in the cart");

  // Into the cart, with no signal.
  await context.setOffline(true);
  await produce.getByRole("checkbox", { name: "garlic" }).click();
  const cart = page.getByRole("region", { name: "In the cart" });
  await expect(cart.getByRole("checkbox", { name: "garlic" })).toHaveAttribute("aria-checked", "true");
  await expect(progress).toContainText("4 to get · 1 in the cart");
  await expect(page.getByTestId("status-line")).toContainText("waiting to sync");
  await context.setOffline(false);
  await expect(page.getByTestId("status-line")).toContainText("Synced");

  // Your own items.
  await page.getByLabel("Add something else").fill("Paper towels");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("region", { name: "Other" }).getByRole("checkbox", { name: "Paper towels" })).toBeVisible();
  await page.getByRole("button", { name: "Remove Paper towels" }).click();
  await expect(page.getByRole("checkbox", { name: "Paper towels" })).toHaveCount(0);

  // Fewer recipes, smaller amounts; the check mark stays.
  await page.getByRole("button", { name: "Change recipes" }).click();
  const change = page.getByRole("dialog", { name: "Recipes for this trip" });
  await change.getByRole("checkbox", { name: /Lemon chicken/ }).click();
  await change.getByRole("button", { name: "Shop for 1 recipe" }).click();
  await expect(produce.getByRole("checkbox", { name: "lemons" })).toContainText("2 lemons");
  await expect(cart.getByRole("checkbox", { name: "garlic" })).toContainText("3 cloves garlic");

  // Still there after reopening.
  await page.reload();
  await page.getByRole("button", { name: "Shop" }).click();
  const trip = page.getByRole("list", { name: "Your trips" }).getByRole("button", { name: /Weekend shop/ });
  await expect(trip).toContainText("1 recipe · 3 to get");
  await trip.click();
  await page.getByRole("button", { name: "Uncheck all" }).click();
  await expect(page.getByTestId("trip-progress")).toHaveText("4 to get · 0 in the cart");

  // Shopping for a bigger batch: the recipe has no servings set, so it steps by multiples.
  const howMuch = page.getByRole("group", { name: "How much Lemon pasta to shop for" });
  await expect(howMuch.getByTestId("stepper-value")).toHaveText("1×");
  await howMuch.getByRole("button", { name: "More" }).click();
  await expect(howMuch.getByTestId("stepper-value")).toHaveText("1½×");
  await expect(produce.getByRole("checkbox", { name: "lemons" })).toContainText("3 lemons");
  await expect(produce.getByRole("checkbox", { name: "garlic" })).toContainText("4 1/2 cloves garlic");
  await page.getByRole("button", { name: "Delete trip" }).click();
  await page.getByRole("button", { name: "Yes, delete" }).click();
  await expect(page.getByRole("list", { name: "Your trips" })).toHaveCount(0);
});
