import { describe, expect, it } from "vitest";
import { parseIngredient } from "@/lib/model/recipe";
import { fitsFilters, matchRecipe, MAX_HAVE, missingText, NO_FILTERS, splitHave, whatCanIMake, type Matchable } from "@/lib/suggest/have";

const recipe = (title: string, lines: string[], extra: Partial<Matchable> = {}): Matchable => ({
  title,
  ingredients: lines.map(parseIngredient),
  tags: [],
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

  it("narrows by how it's cooked, how long it takes, and how hard it is", () => {
    const fast = recipe("Air fryer wings", ["2 lb chicken wings"], { tags: ["method/air-fryer", "time/under-30-min", "effort/easy"] });
    const slow = recipe("Braised chicken", ["4 chicken thighs"], { tags: ["method/oven", "time/over-an-hour", "effort/medium"] });
    const old = recipe("Chicken stew", ["1 lb chicken"], { tags: ["effort/slow-cooker", "effort/weeknight"] });
    const plain = recipe("Chicken salad", ["2 cups chicken"]);
    const list = [fast, slow, old, plain];
    const titles = (f: Partial<typeof NO_FILTERS>) => whatCanIMake(list, ["chicken"], [], { ...NO_FILTERS, ...f }).map((m) => m.recipe.title).sort();
    expect(titles({})).toHaveLength(4);
    expect(titles({ method: "air-fryer" })).toEqual(["Air fryer wings"]);
    // Tags saved before methods existed still count.
    expect(titles({ method: "slow-cooker" })).toEqual(["Chicken stew"]);
    expect(titles({ time: 30 })).toEqual(["Air fryer wings"]);
    expect(titles({ time: 60 })).toEqual(["Air fryer wings", "Chicken stew"]);
    expect(titles({ easy: true })).toEqual(["Air fryer wings"]);
    expect(titles({ method: "oven", time: 30 })).toEqual([]);
    expect(fitsFilters([], NO_FILTERS)).toBe(true);
  });
});
