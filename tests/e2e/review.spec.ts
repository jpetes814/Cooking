import { expect, test } from "@playwright/test";
import { signIn, TESTER } from "./firebase";

test("checks a photo-read recipe before saving, and goes back to fix it", async ({ page }) => {
  await signIn(page, TESTER);
  const buffer = Buffer.from(
    await page.evaluate(() => {
      const c = document.createElement("canvas");
      c.width = 60;
      c.height = 80;
      c.getContext("2d")!.fillRect(0, 0, 60, 80);
      return c.toDataURL("image/png").split(",")[1];
    }),
    "base64"
  );

  await page.getByRole("button", { name: "+ Add recipe" }).click();
  const sheet = page.getByRole("dialog", { name: "New recipe" });
  await sheet.getByLabel("Add photos").setInputFiles({ name: "card.png", mimeType: "image/png", buffer });

  // Editor thumbnails open full size.
  await sheet.getByRole("button", { name: "View photo 1" }).click();
  const viewer = page.getByRole("dialog", { name: "Photo" });
  await expect(viewer.getByRole("img")).toBeVisible();
  await viewer.getByRole("button", { name: "Close" }).click();

  await sheet.getByRole("button", { name: "Read photo with Claude" }).click();
  await expect(sheet.getByRole("status")).toContainText("Claude read it");
  await sheet.getByRole("group", { name: "Suggested tags" }).getByRole("button", { name: "Add all" }).click();
  await sheet.getByLabel("Ingredients").fill(`${await sheet.getByLabel("Ingredients").inputValue()}\nbutter`);

  await sheet.getByRole("button", { name: "Review recipe" }).click();
  const preview = sheet.getByTestId("recipe-preview");
  await expect(preview.getByRole("heading", { name: "Lemon garlic pasta" })).toBeVisible();
  const checks = preview.getByRole("list", { name: "Worth checking" });
  await expect(checks).toContainText("Claude filled this in");
  await expect(checks).toContainText("3 tags were suggested by Claude.");
  await expect(checks).toContainText("No amount on 1 ingredient: butter.");
  await expect(preview.getByRole("list", { name: "Tags to save" })).toContainText("pasta");
  await expect(preview.getByText("200 g", { exact: false })).toBeVisible();

  // Compare with the photo full size.
  await preview.getByRole("button", { name: "Compare with photo 1" }).click();
  await expect(page.getByRole("dialog", { name: "Photo" }).getByRole("img")).toBeVisible();
  await page.getByRole("dialog", { name: "Photo" }).getByRole("button", { name: "Close" }).click();

  // Back to edit keeps everything; fix the missing amount.
  await sheet.getByRole("button", { name: "Back to edit" }).click();
  await expect(sheet.getByLabel("Name")).toHaveValue("Lemon garlic pasta");
  const ingredients = await sheet.getByLabel("Ingredients").inputValue();
  await sheet.getByLabel("Ingredients").fill(ingredients.replace(/\nbutter$/, "\n2 Tbsp butter"));
  await sheet.getByRole("button", { name: "Review recipe" }).click();
  await expect(preview.getByRole("list", { name: "Worth checking" })).not.toContainText("No amount");

  await sheet.getByRole("button", { name: "Looks good, save" }).click();
  await expect(page.getByRole("heading", { name: "Lemon garlic pasta" })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "butter" })).toContainText("2 tbsp butter");
});
