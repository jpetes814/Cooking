import { describe, expect, it } from "vitest";
import { missingAmounts, reviewNotes } from "@/lib/model/review";
import { parseIngredient } from "@/lib/model/recipe";

const recipe = (ingredients: string[], steps: string[] = ["Cook"], tags: string[] = []) => ({
  ingredients: ingredients.map(parseIngredient),
  steps,
  tags,
});

describe("missingAmounts", () => {
  it("flags lines with no amount, except the ones that never have one", () => {
    expect(missingAmounts(recipe(["2 cups flour", "butter", "salt to taste", "parsley, for garnish", "eggs"]))).toEqual([
      "butter",
      "eggs",
    ]);
  });
});

describe("reviewNotes", () => {
  it("is quiet for a complete, hand-typed recipe", () => {
    expect(reviewNotes(recipe(["2 cups flour"]), { filledByClaude: false, claudeTags: [] })).toEqual([]);
  });

  it("points out what Claude did and what's missing", () => {
    const notes = reviewNotes(recipe(["butter", "2 eggs"], [], ["dish/pasta", "effort/quick", "mine"]), {
      filledByClaude: true,
      claudeTags: ["dish/pasta", "effort/quick", "cuisine/italian"],
    });
    expect(notes.map((n) => n.text)).toEqual([
      "Claude filled this in. Compare the amounts and steps with the photo or link.",
      "2 tags were suggested by Claude.",
      "No amount on 1 ingredient: butter.",
      "No steps yet.",
    ]);
  });

  it("shortens a long list", () => {
    const notes = reviewNotes(recipe(["a", "b", "c", "d"]), { filledByClaude: false, claudeTags: [] });
    expect(notes[0].text).toBe("No amount on 4 ingredients: a, b, c and 1 more.");
  });
});
