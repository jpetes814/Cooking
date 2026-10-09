import { expect, test, type Page } from "@playwright/test";
import { COOK, signIn } from "./firebase";

async function addRecipe(page: Page, name: string, stars?: number) {
  await page.getByRole("button", { name: "+ Add recipe" }).click();
  const sheet = page.getByRole("dialog", { name: "New recipe" });
  await sheet.getByLabel("Name").fill(name);
  await sheet.getByRole("button", { name: "Review recipe" }).click();
  await sheet.getByRole("button", { name: "Looks good, save" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  if (stars) await page.getByRole("group", { name: "Rating" }).getByRole("button", { name: `${stars} stars` }).click();
  await page.getByRole("button", { name: "‹ All recipes" }).click();
}

test("suggests ideas for tonight, shuffles, leans on the weather, and works offline", async ({ page, context }) => {
  await signIn(page, COOK);
  const card = page.getByRole("region", { name: "Ideas for tonight" });
  const picks = card.getByRole("listitem");

  await addRecipe(page, "Beef stew");
  await addRecipe(page, "Grilled corn salad");
  await expect(card).toHaveCount(0); // Needs a few recipes first.
  await addRecipe(page, "Lemon pasta", 5);
  await addRecipe(page, "Plain toast");

  await expect(picks).toHaveCount(3);
  await expect(picks.first()).toContainText("Lemon pasta");
  await expect(picks.first()).toContainText("a favorite");
  await expect(card.getByTestId("ideas-why")).toHaveText("Picked from your favorites and the season.");

  // Shuffle shows the rest, then wraps.
  await card.getByRole("button", { name: "Shuffle" }).click();
  await expect(picks.first()).toContainText("Beef stew");
  await card.getByRole("button", { name: "Shuffle" }).click();
  await expect(picks.first()).toContainText("Lemon pasta");
  await expect(card).not.toContainText("Beef stew");

  // A cold, rainy night brings the stew up. Only rounded coordinates go out.
  let asked = "";
  await page.route("https://api.open-meteo.com/**", (route) => {
    asked = route.request().url();
    return route.fulfill({ json: { current: { temperature_2m: 6, precipitation: 1.2, weather_code: 61 } } });
  });
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 47.60621, longitude: -122.33207 });
  await card.getByRole("button", { name: "Use local weather" }).click();
  await expect(card.getByTestId("ideas-why")).toHaveText("Chilly and rainy, so cozy picks first.");
  expect(asked).toContain("latitude=47.6&longitude=-122.3");
  await expect(picks.nth(1)).toContainText("Beef stew");
  await expect(picks.nth(1)).toContainText("cozy for tonight");

  // Tapping a pick opens it.
  await picks.nth(1).getByRole("button").click();
  await expect(page.getByRole("heading", { name: "Beef stew" })).toBeVisible();
  await page.getByRole("button", { name: "‹ All recipes" }).click();

  // No signal: the last reading still counts. (Routing stops the offline cache from serving the page, so drop it.)
  await page.unrouteAll();
  await context.setOffline(true);
  await page.reload();
  await expect(picks).toHaveCount(3);
  await expect(card.getByTestId("ideas-why")).toHaveText("Chilly and rainy, so cozy picks first.");
  await card.getByRole("button", { name: "Turn off weather" }).click();
  await expect(card.getByTestId("ideas-why")).toHaveText("Picked from your favorites and the season.");
  await context.setOffline(false);

  // Searching hides the card; Hide is remembered.
  await page.getByLabel("Search recipes").fill("toast");
  await expect(card).toHaveCount(0);
  await page.getByLabel("Search recipes").fill("");
  await card.getByRole("button", { name: "Hide" }).click();
  await expect(picks).toHaveCount(0);
  await page.reload();
  await expect(card.getByRole("button", { name: "Show" })).toBeVisible();
});
