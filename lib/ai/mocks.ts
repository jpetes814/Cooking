import type { ExtractedRecipe } from "./prompts/import";
import type { Sources } from "@/lib/import/sources";

/**
 * Stand-ins for tests and local dev (AI_MOCK=1). Deterministic and shaped like
 * the real thing, so the whole flow runs with no Claude key, no network, and
 * no spend. Sample recipes are made up.
 */

/** Pretends to read text: finds a recipe only if the text mentions garlic. */
export function mockExtract(text: string): ExtractedRecipe {
  if (!/garlic/i.test(text)) {
    return { found: false, title: "", servings: null, ingredients: [], steps: [], notes: "" };
  }
  return {
    found: true,
    title: "Lemon garlic pasta",
    servings: 2,
    ingredients: ["200 g spaghetti", "2 lemons", "3 cloves garlic, sliced", "2 Tbsp olive oil", "salt to taste"],
    steps: ["Boil the pasta in salted water.", "Sizzle the garlic in the oil.", "Toss everything with lemon juice and zest."],
    notes: "Add chili flakes if you like heat.",
  };
}

const JSONLD_PAGE = `<!doctype html><html><head><title>Sheet pan gnocchi | A sample food blog</title>
<script type="application/ld+json">${JSON.stringify({
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "WebSite", name: "A sample food blog" },
    {
      "@type": "Recipe",
      name: "Sheet pan gnocchi",
      recipeYield: ["4", "4 servings"],
      recipeIngredient: ["1 lb shelf-stable gnocchi", "1 pint cherry tomatoes", "2 Tbsp olive oil", "1/2 tsp salt"],
      recipeInstructions: [
        { "@type": "HowToStep", text: "Heat the oven to 425&deg;F." },
        { "@type": "HowToSection", name: "Roast", itemListElement: [{ "@type": "HowToStep", text: "Toss everything on a sheet pan." }, { "@type": "HowToStep", text: "Roast 20 minutes." }] },
      ],
    },
  ],
})}</script></head><body><p>A long story about autumn...</p></body></html>`;

const PLAIN_PAGE = `<!doctype html><html><head><title>Grandma's pasta</title></head><body>
<p>My favorite weeknight dinner. You need spaghetti, lemons, garlic, and olive oil.</p>
<p>Boil the pasta, sizzle the garlic, toss with lemon. ${"Lots of words about the kitchen. ".repeat(10)}</p></body></html>`;

/** Fake sites: example.com/recipes/* has JSON-LD, other example.com pages don't. */
export const mockSources: Sources = {
  async page(url) {
    const u = new URL(url);
    if (u.hostname !== "example.com") return { ok: false, error: "Couldn't reach that site. Check the link, or try again in a moment." };
    if (u.pathname.startsWith("/recipes/")) {
      const { recipeFromHtml } = await import("@/lib/import/html");
      return { ok: true, recipe: recipeFromHtml(JSONLD_PAGE), text: "" };
    }
    const { pageText } = await import("@/lib/import/html");
    return { ok: true, recipe: null, text: pageText(PLAIN_PAGE) };
  },
  async tiktok(url) {
    if (url.includes("/video/0")) return { ok: true, caption: "dinner tonight 🔥 #foodtok", author: "somecook" };
    return {
      ok: true,
      author: "somecook",
      caption: "Lemon garlic pasta 🍋 200g spaghetti, 2 lemons, 3 cloves garlic, 2 tbsp olive oil. Boil, sizzle, toss! #pasta",
    };
  },
  async youtube() {
    return { ok: true, title: "The easiest lemon garlic pasta", description: "You need spaghetti, lemons, garlic, olive oil." };
  },
};
