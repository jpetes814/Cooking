import { expect, test, type Page } from "@playwright/test";
import { signIn, TESTER } from "./firebase";

async function addTagged(page: Page, name: string, ingredients: string, addTags: (sheet: ReturnType<Page["getByRole"]>) => Promise<void>) {
  await page.getByRole("button", { name: "+ Add recipe" }).click();
  const sheet = page.getByRole("dialog", { name: "New recipe" });
  await sheet.getByLabel("Name").fill(name);
  await sheet.getByLabel("Ingredients").fill(ingredients);
  await addTags(sheet);
  await sheet.getByRole("button", { name: "Save recipe" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  await page.getByRole("button", { name: "‹ All recipes" }).click();
}

test("tags recipes, then finds them by tag, sub-tag, words, and ingredients", async ({ page }) => {
  await signIn(page, TESTER);

  await addTagged(page, "Zesty quinoa soup", "1 cup quinoa\n2 lemons\n4 cups stock", async (sheet) => {
    await sheet.getByRole("button", { name: "Show tag ideas" }).click();
    await sheet.getByRole("button", { name: "Add tag dish/soup" }).click();
    await sheet.getByRole("button", { name: "Add tag season/fall" }).click();
    await expect(sheet.getByRole("button", { name: "Add tag dish/soup" })).toHaveCount(0);
  });

  await addTagged(page, "Zesty quinoa salad", "1 cup quinoa\n1 lemon\n1 cucumber", async (sheet) => {
    // Your own tags, typed: a plain one and a sub-tag.
    await sheet.getByLabel("New tag").fill("Picnic");
    await sheet.getByRole("button", { name: "Add tag", exact: true }).click();
    await sheet.getByLabel("New tag").fill("Cuisine / Greek");
    await sheet.getByLabel("New tag").press("Enter");
    await expect(sheet.getByRole("list", { name: "This recipe's tags" })).toContainText("greek");
    await sheet.getByRole("button", { name: "Remove tag picnic" }).click();
    // Tags from other recipes are offered first.
    await sheet.getByRole("button", { name: "Show tag ideas" }).click();
    await expect(sheet.getByText("Your tags")).toBeVisible();
  });

  const search = page.getByLabel("Search recipes");
  const results = page.getByRole("button", { name: /Zesty quinoa/ });

  await search.fill("zesty soups");
  await expect(results).toHaveCount(1);
  await expect(results).toContainText("Zesty quinoa soup");

  await search.fill("zesty, cucumber");
  await expect(results).toHaveCount(1);
  await expect(results).toContainText("Zesty quinoa salad");

  await search.fill("zesty quinoa lemon");
  await expect(results).toHaveCount(2);

  // A group filter finds everything under it.
  await search.fill("zesty");
  const filters = page.getByRole("group", { name: "Filter by tag" });
  await filters.getByRole("button", { name: "cuisine", exact: true }).click();
  await expect(results).toHaveCount(1);
  await expect(results).toContainText("Zesty quinoa salad");
  await page.getByRole("button", { name: "Clear" }).click();
  await expect(search).toHaveValue("");

  // The in-season chip is always there.
  await expect(filters.getByRole("button", { name: /^In season: / })).toBeVisible();

  // Tapping a tag on a recipe shows every recipe with it.
  await page.getByRole("button", { name: /Zesty quinoa soup/ }).click();
  await page.getByRole("button", { name: "More recipes tagged dish/soup" }).click();
  await expect(filters.getByRole("button", { name: /soup/ }).first()).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: /Zesty quinoa soup/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Zesty quinoa salad/ })).toHaveCount(0);
});
