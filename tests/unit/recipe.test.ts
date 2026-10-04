import { describe, expect, it } from "vitest";
import {
  buildRecipe,
  formatAmount,
  formatQty,
  parseIngredient,
  parseLink,
  sortRecipes,
  splitLines,
  stripMarker,
  toInput,
  type RecipeInput,
} from "@/lib/model/recipe";

const NOW = 1_700_000_000_000;
const blank: RecipeInput = { title: "", url: "", servings: "", ingredients: "", steps: "", notes: "" };

describe("parseIngredient", () => {
  it.each([
    ["2 cups diced onion", 2, "cup", "diced onion"],
    ["1/2 tsp salt", 0.5, "tsp", "salt"],
    ["1 1/2 cups flour", 1.5, "cup", "flour"],
    ["1½ cups milk", 1.5, "cup", "milk"],
    ["½ cup sugar", 0.5, "cup", "sugar"],
    ["2 Tbsp. olive oil", 2, "tbsp", "olive oil"],
    ["1 T butter", 1, "tbsp", "butter"],
    ["3 cloves garlic, minced", 3, "clove", "garlic, minced"],
    ["2-3 cloves garlic", 2, "clove", "garlic"],
    ["2 to 3 limes", 2, null, "limes"],
    ["3 eggs", 3, null, "eggs"],
    ["400 g chickpeas", 400, "g", "chickpeas"],
    ["2 cups of flour", 2, "cup", "flour"],
    ["1 (14 oz) can coconut milk", 1, null, "(14 oz) can coconut milk"],
  ])("%s", (line, qty, unit, name) => {
    expect(parseIngredient(line)).toEqual({ raw: line, qty, unit, name });
  });

  it("keeps lines with no quantity whole", () => {
    expect(parseIngredient("salt to taste")).toEqual({ raw: "salt to taste", qty: null, unit: null, name: "salt to taste" });
  });

  it("doesn't mistake a lone unit-looking word for a unit", () => {
    expect(parseIngredient("2 cups")).toEqual({ raw: "2 cups", qty: 2, unit: null, name: "cups" });
  });

  it("drops pasted list markers", () => {
    expect(parseIngredient("- 1 lb chicken thighs").raw).toBe("1 lb chicken thighs");
    expect(parseIngredient("• 1 lb chicken thighs").unit).toBe("lb");
  });
});

describe("splitLines and stripMarker", () => {
  it("drops blanks and numbering", () => {
    expect(splitLines("1. Chop the onion\n\n2) Fry it\nStep 3: Eat\n  • Wash up  ")).toEqual([
      "Chop the onion",
      "Fry it",
      "Eat",
      "Wash up",
    ]);
  });

  it("leaves numbers that are part of the text", () => {
    expect(stripMarker("350F oven for 20 minutes")).toBe("350F oven for 20 minutes");
  });
});

describe("formatQty", () => {
  it("shows cooking fractions", () => {
    expect(formatQty(1.5)).toBe("1 1/2");
    expect(formatQty(0.333)).toBe("1/3");
    expect(formatQty(2)).toBe("2");
    expect(formatQty(0.3)).toBe("0.3");
  });
});

describe("formatAmount", () => {
  it("pluralizes words, not abbreviations", () => {
    expect(formatAmount({ qty: 1.5, unit: "cup" })).toBe("1 1/2 cups");
    expect(formatAmount({ qty: 0.5, unit: "cup" })).toBe("1/2 cup");
    expect(formatAmount({ qty: 1, unit: "clove" })).toBe("1 clove");
    expect(formatAmount({ qty: 3, unit: "clove" })).toBe("3 cloves");
    expect(formatAmount({ qty: 2, unit: "pinch" })).toBe("2 pinches");
    expect(formatAmount({ qty: 2, unit: "tbsp" })).toBe("2 tbsp");
    expect(formatAmount({ qty: 3, unit: null })).toBe("3");
    expect(formatAmount({ qty: null, unit: null })).toBe("");
  });
});

describe("parseLink", () => {
  it("labels the big video sites", () => {
    expect(parseLink("https://www.tiktok.com/@cook/video/123")).toMatchObject({ ok: true, site: "tiktok" });
    expect(parseLink("https://vm.tiktok.com/abc/")).toMatchObject({ ok: true, site: "tiktok" });
    expect(parseLink("https://www.instagram.com/reel/abc/")).toMatchObject({ ok: true, site: "instagram" });
    expect(parseLink("https://youtu.be/abc")).toMatchObject({ ok: true, site: "youtube" });
    expect(parseLink("https://m.youtube.com/watch?v=abc")).toMatchObject({ ok: true, site: "youtube" });
    expect(parseLink("https://example.com/soup")).toMatchObject({ ok: true, site: "web" });
  });

  it("adds https to a bare link", () => {
    expect(parseLink("tiktok.com/@cook/video/1")).toEqual({ ok: true, url: "https://tiktok.com/@cook/video/1", site: "tiktok" });
  });

  it("rejects things that aren't links", () => {
    expect(parseLink("").ok).toBe(false);
    expect(parseLink("my grandma's soup").ok).toBe(false);
    expect(parseLink("javascript:alert(1)").ok).toBe(false);
    expect(parseLink("localhost").ok).toBe(false);
  });
});

describe("buildRecipe", () => {
  it("needs a name and nothing else", () => {
    expect(buildRecipe(blank, NOW)).toEqual({ ok: false, error: "Give it a name." });
    const r = buildRecipe({ ...blank, title: "  Tomato   soup " }, NOW);
    expect(r).toEqual({
      ok: true,
      recipe: {
        title: "Tomato soup",
        source: { kind: "manual", url: null },
        servings: null,
        ingredients: [],
        steps: [],
        tags: [],
        notes: "",
        photos: {},
        createdAt: NOW,
        updatedAt: NOW,
      },
    });
  });

  it("saves a link-only recipe", () => {
    const r = buildRecipe({ ...blank, title: "Viral pasta", url: "tiktok.com/@cook/video/1" }, NOW);
    expect(r.ok && r.recipe.source).toEqual({ kind: "link", url: "https://tiktok.com/@cook/video/1" });
  });

  it("parses ingredients and steps one per line", () => {
    const r = buildRecipe(
      { ...blank, title: "Soup", servings: "4", ingredients: "2 cups stock\n\n1 onion", steps: "1. Chop\n2. Simmer" },
      NOW
    );
    expect(r.ok && r.recipe.ingredients.map((i) => i.name)).toEqual(["stock", "onion"]);
    expect(r.ok && r.recipe.steps).toEqual(["Chop", "Simmer"]);
    expect(r.ok && r.recipe.servings).toBe(4);
  });

  it("explains bad input", () => {
    expect(buildRecipe({ ...blank, title: "x".repeat(121) }, NOW).ok).toBe(false);
    expect(buildRecipe({ ...blank, title: "Soup", url: "not a link" }, NOW)).toEqual({
      ok: false,
      error: "That doesn't look like a link.",
    });
    expect(buildRecipe({ ...blank, title: "Soup", servings: "lots" }, NOW).ok).toBe(false);
    expect(buildRecipe({ ...blank, title: "Soup", servings: "0" }, NOW).ok).toBe(false);
  });

  it("keeps the creation time and tags when editing", () => {
    const first = buildRecipe({ ...blank, title: "Soup" }, NOW);
    if (!first.ok) throw new Error("expected ok");
    const tagged = { ...first.recipe, tags: ["meal/soup"] };
    const edited = buildRecipe({ ...toInput(tagged), title: "Better soup" }, NOW + 5, tagged);
    expect(edited.ok && edited.recipe).toMatchObject({ title: "Better soup", createdAt: NOW, updatedAt: NOW + 5, tags: ["meal/soup"] });
  });

  it("round-trips through the editor without losing what was typed", () => {
    const input = { ...blank, title: "Soup", url: "https://example.com/soup", servings: "2", ingredients: "1 1/2 cups stock\nsalt to taste", steps: "Simmer\nServe", notes: "Good cold" };
    const r = buildRecipe(input, NOW);
    if (!r.ok) throw new Error("expected ok");
    expect(toInput(r.recipe)).toEqual(input);
  });
});

describe("sortRecipes", () => {
  it("puts the newest first", () => {
    const list = [
      { title: "B", updatedAt: 1 },
      { title: "A", updatedAt: 3 },
      { title: "C", updatedAt: 3 },
    ];
    expect(sortRecipes(list).map((r) => r.title)).toEqual(["A", "C", "B"]);
  });
});
