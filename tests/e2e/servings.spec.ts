import { expect, test } from "@playwright/test";
import { signIn, TESTER } from "./firebase";

test("scales a recipe's amounts for more or fewer servings, without changing it", async ({ page }) => {
  await signIn(page, TESTER);
  await page.getByRole("button", { name: "+ Add recipe" }).click();
  const sheet = page.getByRole("dialog", { name: "New recipe" });
  await sheet.getByLabel("Name").fill("Scaled carrot soup");
  await sheet.getByLabel("Servings").fill("4");
  await sheet.getByLabel("Ingredients").fill("2 cups stock\n3 carrots\nsalt to taste");
  await sheet.getByRole("button", { name: "Review recipe" }).click();
  await sheet.getByRole("button", { name: "Looks good, save" }).click();

  const howMuch = page.getByRole("group", { name: "How much to make" });
  const value = howMuch.getByTestId("stepper-value");
  await expect(value).toHaveText("Serves 4");
  await howMuch.getByRole("button", { name: "Fewer" }).click();
  await howMuch.getByRole("button", { name: "Fewer" }).click();
  await expect(value).toHaveText("Serves 2");
  const ingredients = page.getByRole("listitem").filter({ hasText: "stock" });
  await expect(ingredients).toHaveText("1 cup stock");
  await expect(page.getByRole("listitem").filter({ hasText: "carrots" })).toHaveText("1 1/2 carrots");
  await expect(page.getByRole("listitem").filter({ hasText: "salt" })).toHaveText("salt to taste");
  await expect(page.getByTestId("scaled-note")).toContainText("Scaled from 4 servings");

  // Remembered on this phone while you cook.
  await page.reload();
  await page.getByRole("list", { name: "Your recipes" }).getByRole("button", { name: /Scaled carrot soup/ }).click();
  await expect(value).toHaveText("Serves 2");

  // The saved recipe never changed.
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Edit recipe" }).getByLabel("Servings")).toHaveValue("4");
  await page.getByRole("dialog", { name: "Edit recipe" }).getByRole("button", { name: "Close" }).click();

  await page.getByRole("button", { name: "Reset" }).click();
  await expect(value).toHaveText("Serves 4");
  await expect(ingredients).toHaveText("2 cups stock");
});
