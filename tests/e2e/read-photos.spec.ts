import { expect, test } from "@playwright/test";
import { signIn, TESTER } from "./firebase";

test("Claude reads a recipe photo into a draft and suggests tags", async ({ page }) => {
  await signIn(page, TESTER);
  const buffer = Buffer.from(
    await page.evaluate(() => {
      const c = document.createElement("canvas");
      c.width = 60;
      c.height = 80;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, 60, 80);
      return c.toDataURL("image/png").split(",")[1];
    }),
    "base64"
  );

  await page.getByRole("button", { name: "+ Add recipe" }).click();
  const sheet = page.getByRole("dialog", { name: "New recipe" });
  await expect(sheet.getByRole("button", { name: /Read photo/ })).toHaveCount(0);
  await sheet.getByLabel("Add photos").setInputFiles({ name: "page.png", mimeType: "image/png", buffer });

  await sheet.getByRole("button", { name: "Read photo with Claude" }).click();
  await expect(sheet.getByRole("status")).toContainText("Claude read it");
  await expect(sheet.getByLabel("Name")).toHaveValue("Lemon garlic pasta");
  await expect(sheet.getByLabel("Ingredients")).toHaveValue(/200 g spaghetti/);

  // Suggested tags wait for a tap.
  const suggestions = sheet.getByRole("group", { name: "Suggested tags" });
  await expect(suggestions).toContainText("pasta");
  await expect(sheet.getByRole("list", { name: "This recipe's tags" })).toHaveCount(0);
  await suggestions.getByRole("button", { name: "Add suggested tag effort/quick" }).click();
  await expect(sheet.getByRole("list", { name: "This recipe's tags" })).toContainText("quick");
  await suggestions.getByRole("button", { name: "Add all" }).click();
  await expect(suggestions).toHaveCount(0);

  await sheet.getByRole("button", { name: "Review recipe" }).click();

  await sheet.getByRole("button", { name: "Looks good, save" }).click();
  await expect(page.getByRole("heading", { name: "Lemon garlic pasta" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Tags" })).toContainText("italian");
});

test("reading photos says it needs signal when offline", async ({ page, context }) => {
  await signIn(page, TESTER);
  const buffer = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64"
  );
  await page.getByRole("button", { name: "+ Add recipe" }).click();
  const sheet = page.getByRole("dialog", { name: "New recipe" });
  await sheet.getByLabel("Add photos").setInputFiles({ name: "p.png", mimeType: "image/png", buffer });
  await expect(sheet.getByRole("button", { name: "Read photo with Claude" })).toBeEnabled();
  await context.setOffline(true);
  await expect(sheet.getByRole("button", { name: "Reading photos needs signal" })).toBeDisabled();
  await context.setOffline(false);
});
