import { describe, expect, it } from "vitest";
import { currentSeason, normalizeTag, normalizeTags, tagCounts, tagGroup, tagLeaf, tagMatches } from "@/lib/search/tags";
import { filterRecipes, parseQuery, stem } from "@/lib/search/recipes";
import { parseIngredient } from "@/lib/model/recipe";

describe("tags", () => {
  it("normalizes paths, spacing, capitals, and hashtags", () => {
    expect(normalizeTag("  Cuisine / Middle  Eastern ")).toBe("cuisine/middle eastern");
    expect(normalizeTag("#Weeknight")).toBe("weeknight");
    expect(normalizeTag("a/b/c/d")).toBe("a/b/c");
    expect(normalizeTag(" / ")).toBeNull();
    expect(normalizeTag("x".repeat(61))).toBeNull();
  });

  it("dedupes and sorts a list", () => {
    expect(normalizeTags(["Soup", "soup", "season/Fall", ""])).toEqual(["season/fall", "soup"]);
  });

  it("splits groups and leaves", () => {
    expect(tagLeaf("cuisine/thai")).toBe("thai");
    expect(tagLeaf("soup")).toBe("soup");
    expect(tagGroup("cuisine/thai")).toBe("cuisine");
    expect(tagGroup("soup")).toBeNull();
  });

  it("matches a group to everything under it, and nothing that merely starts the same", () => {
    expect(tagMatches("cuisine", "cuisine/thai")).toBe(true);
    expect(tagMatches("cuisine/thai", "cuisine/thai")).toBe(true);
    expect(tagMatches("cuisine/thai", "cuisine")).toBe(false);
    expect(tagMatches("soup", "soups")).toBe(false);
  });

  it("counts tags and their groups once per recipe", () => {
    const counts = tagCounts([
      { tags: ["cuisine/thai", "cuisine/indian"] },
      { tags: ["cuisine/thai", "soup"] },
    ]);
    expect(counts.slice(0, 2)).toEqual([
      { tag: "cuisine", count: 2 },
      { tag: "cuisine/thai", count: 2 },
    ]);
    expect(counts.find((c) => c.tag === "soup")?.count).toBe(1);
  });

  it("knows the season", () => {
    expect(currentSeason(new Date(2026, 9, 4))).toBe("fall");
    expect(currentSeason(new Date(2026, 0, 15))).toBe("winter");
    expect(currentSeason(new Date(2026, 3, 1))).toBe("spring");
    expect(currentSeason(new Date(2026, 6, 1))).toBe("summer");
  });
});

describe("search", () => {
  const recipe = (title: string, tags: string[], ingredients: string[], notes = "") => ({
    title,
    tags,
    ingredients: ingredients.map(parseIngredient),
    notes,
  });
  const soup = recipe("Butternut squash soup", ["dish/soup", "season/fall"], ["1 butternut squash", "2 cups stock", "1 onion"]);
  const curry = recipe("Thai green curry", ["cuisine/thai", "dish/curry"], ["1 lb chicken thighs", "1 can coconut milk", "2 limes"]);
  const salad = recipe("Lemony chicken salad", ["season/summer"], ["2 chicken breasts", "1 lemon", "salad greens"], "Great with crusty bread");
  const all = [soup, curry, salad];

  it("forgives plurals", () => {
    expect(stem("soups")).toBe("soup");
    expect(stem("tomatoes")).toBe("tomato");
    expect(stem("berries")).toBe("berry");
    expect(stem("glass")).toBe("glass");
  });

  it("keeps comma phrases together", () => {
    expect(parseQuery("chicken thighs, Lemons")).toEqual(["chicken thigh", "lemon"]);
    expect(parseQuery("  chicken  lemon ")).toEqual(["chicken", "lemon"]);
  });

  it("finds by name, tag, ingredient, and notes", () => {
    expect(filterRecipes(all, { query: "soups", tags: [] })).toEqual([soup]);
    expect(filterRecipes(all, { query: "fall", tags: [] })).toEqual([soup]);
    expect(filterRecipes(all, { query: "coconut", tags: [] })).toEqual([curry]);
    expect(filterRecipes(all, { query: "bread", tags: [] })).toEqual([salad]);
  });

  it("needs every ingredient asked for", () => {
    expect(filterRecipes(all, { query: "chicken lemon", tags: [] })).toEqual([salad]);
    expect(filterRecipes(all, { query: "chicken", tags: [] })).toEqual([curry, salad]);
    expect(filterRecipes(all, { query: "chicken, coconut milk", tags: [] })).toEqual([curry]);
  });

  it("matches the start of words while typing", () => {
    expect(filterRecipes(all, { query: "butt", tags: [] })).toEqual([soup]);
  });

  it("combines tag filters with the search", () => {
    expect(filterRecipes(all, { query: "", tags: ["season"] })).toEqual([soup, salad]);
    expect(filterRecipes(all, { query: "chicken", tags: ["season/summer"] })).toEqual([salad]);
    expect(filterRecipes(all, { query: "", tags: ["season/fall", "dish/curry"] })).toEqual([]);
    expect(filterRecipes(all, { query: "  ", tags: [] })).toEqual(all);
  });
});
