import { describe, expect, it } from "vitest";
import { parseIngredient } from "@/lib/model/recipe";
import { shoppingList } from "@/lib/shop/merge";
import { addsText, leftoverIdeas, type Candidate } from "@/lib/shop/useItUp";

const recipe = (id: string, title: string, lines: string[], extra: Partial<Candidate> = {}): Candidate => ({
  id,
  title,
  ingredients: lines.map(parseIngredient),
  rating: null,
  updatedAt: 1,
  ...extra,
});

const tacos = recipe("t", "Fish tacos", ["1 lb cod", "1 bunch cilantro", "2 limes", "8 tortillas", "1 tsp salt"]);
const salsa = recipe("s", "Salsa verde", ["1 bunch cilantro", "1 lime", "1 onion"]);
const curry = recipe("c", "Green curry", ["1 can coconut milk", "1 bunch cilantro", "1 lb chicken thighs", "2 limes", "1 tbsp fish sauce", "1 cup rice"]);
const rice = recipe("r", "Lime rice", ["1 cup rice", "1 lime", "1 tsp salt"]);
const cake = recipe("k", "Vanilla cake", ["2 cups flour", "1 cup sugar"]);
const keys = (rs: Candidate[]) => shoppingList(rs, [], []).aisles.flatMap((a) => a.items.map((i) => i.key));

describe("use it up", () => {
  it("suggests recipes that use what you're already buying, fresh things first", () => {
    const out = leftoverIdeas([tacos, salsa, curry, rice, cake], keys([tacos]), ["t"], ["salt"]);
    expect(out.map((o) => o.recipe.title)).toEqual(["Salsa verde", "Green curry", "Lime rice"]);
    expect(out[0]).toMatchObject({ shares: ["cilantro", "lime"], adds: ["onion"] });
    expect(out[1].adds).toEqual(["coconut milk", "chicken thighs", "fish sauce", "rice"]);
  });

  it("never suggests what's already on the trip, or anything with nothing in common", () => {
    const out = leftoverIdeas([tacos, cake], keys([tacos]), ["t"], []);
    expect(out).toEqual([]);
    expect(leftoverIdeas([salsa], [], [], [])).toEqual([]);
  });

  it("ignores staples on both sides", () => {
    // Salt is on both, but it doesn't make lime rice a better match.
    const out = leftoverIdeas([rice], keys([tacos]), ["t"], ["salt"]);
    expect(out[0]).toMatchObject({ shares: ["lime"], adds: ["rice"] });
  });

  it("breaks ties by fewer extra things to buy, then rating", () => {
    const a = recipe("a", "A", ["2 limes", "1 mango", "1 papaya"]);
    const b = recipe("b", "B", ["2 limes", "1 mango"]);
    const c = recipe("c2", "C", ["2 limes", "1 mango"], { rating: 5 });
    expect(leftoverIdeas([a, b, c], keys([tacos]), ["t"], []).map((o) => o.recipe.title)).toEqual(["C", "B", "A"]);
  });

  it("says what you'd add in a short line", () => {
    expect(addsText([])).toBe("nothing else to buy");
    expect(addsText(["rice", "chicken"])).toBe("adds 2: rice, chicken");
    expect(addsText(["a", "b", "c", "d"])).toBe("adds 4: a, b, c and 1 more");
  });
});
