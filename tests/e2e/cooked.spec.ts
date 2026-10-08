import { expect, test, type Page } from "@playwright/test";
import { signIn, TESTER } from "./firebase";

async function addRecipe(page: Page, name: string) {
  await page.getByRole("button", { name: "+ Add recipe" }).click();
  const sheet = page.getByRole("dialog", { name: "New recipe" });
  await sheet.getByLabel("Name").fill(name);
  await sheet.getByRole("button", { name: "Review recipe" }).click();
  await sheet.getByRole("button", { name: "Looks good, save" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
}

test("rates, logs cooking with undo, and keeps both through an edit", async ({ page }) => {
  await signIn(page, TESTER);
  await addRecipe(page, "Rated risotto");

  const rating = page.getByRole("group", { name: "Rating" });
  const summary = page.getByTestId("cooked-summary");
  await expect(summary).toHaveText("Not cooked yet");

  await rating.getByRole("button", { name: "4 stars" }).click();
  await expect(rating.getByRole("button", { name: "4 stars" })).toHaveAttribute("aria-pressed", "true");
  await expect(rating.getByRole("button", { name: "5 stars" })).toHaveAttribute("aria-pressed", "false");

  await page.getByRole("button", { name: "Cooked it" }).click();
  await expect(summary).toHaveText("Cooked once · last made today");
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(summary).toHaveText("Not cooked yet");
  await page.getByRole("button", { name: "Cooked it" }).click();
  await expect(summary).toHaveText("Cooked once · last made today");

  // Editing the recipe never undoes the rating or the log.
  await page.getByRole("button", { name: "Edit" }).click();
  const sheet = page.getByRole("dialog", { name: "Edit recipe" });
  await sheet.getByLabel("Name").fill("Rated mushroom risotto");
  await sheet.getByRole("button", { name: "Review changes" }).click();
  await sheet.getByRole("button", { name: "Looks good, save" }).click();
  await expect(page.getByRole("heading", { name: "Rated mushroom risotto" })).toBeVisible();
  await expect(rating.getByRole("button", { name: "4 stars" })).toHaveAttribute("aria-pressed", "true");
  await expect(summary).toHaveText("Cooked once · last made today");

  // Tapping the same star again clears it.
  await rating.getByRole("button", { name: "4 stars" }).click();
  await expect(rating.getByRole("button", { name: "1 star" })).toHaveAttribute("aria-pressed", "false");
  await rating.getByRole("button", { name: "5 stars" }).click();

  // The list shows it, filters favorites, and sorts.
  await page.getByRole("button", { name: "‹ All recipes" }).click();
  await addRecipe(page, "Rated plain toast");
  await page.getByRole("group", { name: "Rating" }).getByRole("button", { name: "2 stars" }).click();
  await page.getByRole("button", { name: "‹ All recipes" }).click();

  const risotto = page.getByRole("button", { name: /Rated mushroom risotto/ });
  await expect(risotto).toContainText("★★★★★");
  await expect(risotto).toContainText("made today");

  await page.getByLabel("Search recipes").fill("rated");
  await page.getByRole("button", { name: "★ Favorites" }).click();
  await expect(page.getByRole("button", { name: /^Rated / })).toHaveCount(1);
  await page.getByRole("button", { name: "★ Favorites" }).click();

  await page.getByLabel("Sort recipes").selectOption("rating");
  await expect(page.getByRole("button", { name: /^Rated / }).first()).toContainText("Rated mushroom risotto");
  await page.getByLabel("Sort recipes").selectOption("stale");
  await expect(page.getByRole("button", { name: /^Rated / }).first()).toContainText("Rated plain toast");
});

test("ratings and cooking work offline and sync later", async ({ page, context }) => {
  await signIn(page, TESTER);
  await addRecipe(page, "Road trip chili");
  await expect(page.getByTestId("status-line")).toContainText("Synced");

  await context.setOffline(true);
  await page.getByRole("group", { name: "Rating" }).getByRole("button", { name: "5 stars" }).click();
  await page.getByRole("button", { name: "Cooked it" }).click();
  await expect(page.getByTestId("cooked-summary")).toHaveText("Cooked once · last made today");
  await expect(page.getByTestId("status-line")).toContainText("waiting to sync");

  await context.setOffline(false);
  await expect(page.getByTestId("status-line")).toContainText("Synced");
});
