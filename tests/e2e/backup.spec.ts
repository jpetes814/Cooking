import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { COPIER, signIn, TESTER } from "./firebase";

test("downloads a backup and copies it into another app, skipping what's already there", async ({ page }) => {
  await signIn(page, TESTER);
  await page.getByRole("button", { name: "+ Add recipe" }).click();
  const sheet = page.getByRole("dialog", { name: "New recipe" });
  await sheet.getByLabel("Name").fill("Backup buttermilk biscuits");
  await sheet.getByLabel("Ingredients").fill("2 cups flour\n1 cup buttermilk");
  await sheet.getByRole("button", { name: "Review recipe" }).click();
  await sheet.getByRole("button", { name: "Looks good, save" }).click();
  await page.getByRole("button", { name: "Pantry" }).click();
  await page.getByLabel("New staple").fill("baking soda");
  await page.getByRole("button", { name: "Add", exact: true }).click();

  await page.getByRole("button", { name: "Account" }).click();
  await page.getByRole("button", { name: "Backup and copy" }).click();
  const backup = page.getByRole("dialog", { name: "Backup and copy" });
  await expect(backup).toContainText("Photos aren't included yet");
  const downloading = page.waitForEvent("download");
  await backup.getByRole("button", { name: "Download backup" }).click();
  const file = await downloading;
  expect(file.suggestedFilename()).toMatch(/^recipe-box-backup-\d{4}-\d{2}-\d{2}\.json$/);
  const path = await file.path();
  const json = JSON.parse(readFileSync(path, "utf8"));
  expect(json.recipes.map((r: { title: string }) => r.title)).toContain("Backup buttermilk biscuits");

  // Into the other account, the way you'd copy test to real.
  await backup.getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: "Account" }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  await signIn(page, COPIER);
  await page.getByRole("button", { name: "Account" }).click();
  await page.getByRole("button", { name: "Backup and copy" }).click();
  await backup.getByLabel("Backup file").setInputFiles(path);
  const ready = backup.getByRole("region", { name: "Ready to import" });
  await expect(ready).toContainText(`Add ${json.recipes.length} recipe`);
  await expect(ready).toContainText("Photos don't come along");
  await ready.getByRole("button", { name: "Import" }).click();
  await expect(backup.getByRole("status")).toContainText(`Added ${json.recipes.length} recipe`);
  await backup.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("list", { name: "Your recipes" }).getByRole("button", { name: /Backup buttermilk biscuits/ })).toBeVisible();
  await page.getByRole("button", { name: "Pantry" }).click();
  await expect(page.getByRole("button", { name: "Remove baking soda" })).toBeVisible();

  // Importing the same file again adds nothing.
  await page.getByRole("button", { name: "Account" }).click();
  await page.getByRole("button", { name: "Backup and copy" }).click();
  await backup.getByLabel("Backup file").setInputFiles(path);
  await expect(backup.getByRole("region", { name: "Ready to import" })).toContainText("Everything in this backup is already here");
});

test("says so when the file isn't a backup", async ({ page }) => {
  await signIn(page, TESTER);
  await page.getByRole("button", { name: "Account" }).click();
  await page.getByRole("button", { name: "Backup and copy" }).click();
  const backup = page.getByRole("dialog", { name: "Backup and copy" });
  await backup.getByLabel("Backup file").setInputFiles({ name: "notes.json", mimeType: "application/json", buffer: Buffer.from('{"hello":1}') });
  await expect(backup.getByRole("status")).toHaveText("That file isn't a Recipe Box backup.");
});
