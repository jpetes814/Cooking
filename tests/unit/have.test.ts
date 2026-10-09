import { describe, expect, it } from "vitest";
import { parseIngredient } from "@/lib/model/recipe";
import { matchRecipe, MAX_HAVE, missingText, splitHave, whatCanIMake, type Matchable } from "@/lib/suggest/have";

const recipe = (title: string, lines: string[], extra: Partial<Matchable> = {}): Matchable => ({
  title,
  ingredients: lines.map(parseIngredient),
  rating: null,
  updatedAt: 1,
  ...extra,
});

const piccata = recipe("Chicken piccata", ["4 boneless chicken thighs", "2 lemons", "2 tbsp capers", "salt to taste", "1 tbsp olive oil"]);
const salad = recipe("Spinach salad", ["4 cups baby spinach", "1 lemon", "1/2 cup feta", "2 tbsp fresh dill"]);
const cake = recipe("Carrot cake", ["3 carrots", "2 cups flour", "1 cup sugar", "3 eggs"]);
const curry = recipe("Eggplant curry", ["1 eggplant", "1 can coconut milk"]);
const all = [piccata, salad, cake, curry];

describe("what can I make", () => {
  it("tidies what you type, splitting on commas, without repeats", () => {
    expect(splitHave("Chicken,  Lemons ,, ")).toEqual(["chicken", "lemons"]);
    expect(splitHave("lemon, spinach", ["lemons"])).toEqual(["lemons", "spinach"]);
    expect(splitHave(Array.from({ length: 30 }, (_, i) => `thing${i}`).join(","))).toHaveLength(MAX_HAVE);
  });

  it("matches loosely, either way round, and forgives plurals", () => {
    const m = matchRecipe(piccata, ["chicken", "lemon"], []);
    expect(m?.uses).toEqual(["chicken", "lemon"]);
    expect(matchRecipe(salad, ["Baby Spinach Leaves"], [])?.uses).toEqual(["Baby Spinach Leaves"]);
    expect(matchRecipe(salad, ["spinach"], [])?.uses).toEqual(["spinach"]);
    expect(matchRecipe(cake, ["carrot"], [])?.uses).toEqual(["carrot"]);
    expect(matchRecipe(recipe("Onion soup", ["2 onions"]), ["red onions"], [])?.missing).toEqual([]);
    expect(matchRecipe(recipe("Onion soup", ["2 onions"]), ["green beans"], [])).toBeNull();
    expect(matchRecipe(recipe("Onion soup", ["2 onions"]), ["onion"], [])?.missing).toEqual([]);
  });

  it("doesn't confuse egg with eggplant", () => {
    expect(whatCanIMake(all, ["eggs"]).map((m) => m.recipe.title)).toEqual(["Carrot cake"]);
  });

  it("counts pantry staples as things you have, but not as matches", () => {
    expect(matchRecipe(piccata, ["chicken"], ["salt", "olive oil"])?.missing).toEqual(["lemons", "capers"]);
    expect(whatCanIMake(all, [], ["salt"])).toEqual([]);
    expect(whatCanIMake([cake], ["sugar"], ["flour"])[0].missing).toEqual(["carrots", "eggs"]);
  });

  it("puts recipes that use the most of what you have first, then the closest to done", () => {
    const ranked = whatCanIMake(all, ["lemon", "spinach", "chicken"], ["salt", "olive oil"]);
    expect(ranked.map((m) => m.recipe.title)).toEqual(["Chicken piccata", "Spinach salad"]);
    expect(ranked[0].missing).toEqual(["capers"]);
    expect(ranked[0].covered).toBe(0.8);
    const tie = whatCanIMake([recipe("A", ["lemon", "x", "y"]), recipe("B", ["lemon", "x"]), recipe("C", ["lemon", "x"], { rating: 5 })], ["lemon"]);
    expect(tie.map((m) => m.recipe.title)).toEqual(["C", "B", "A"]);
  });

  it("says what's missing in a short line", () => {
    expect(missingText([])).toBe("you have everything");
    expect(missingText(["feta", "dill"])).toBe("missing 2: feta, dill");
    expect(missingText(["a", "b", "c", "d", "e"])).toBe("missing 5: a, b, c and 2 more");
  });
});
