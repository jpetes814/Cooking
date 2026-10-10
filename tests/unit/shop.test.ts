import { describe, expect, it } from "vitest";
import { parseIngredient } from "@/lib/model/recipe";
import { addAmounts, aisleFor, cleanName, itemKey, shoppingList, type Shoppable } from "@/lib/shop/merge";

const recipe = (id: string, title: string, lines: string[]): Shoppable => ({ id, title, ingredients: lines.map(parseIngredient) });
const amounts = (...lines: string[]) => addAmounts(lines.map(parseIngredient));

describe("shopping list names", () => {
  it("drops how it's cut and what's after a comma", () => {
    expect(cleanName("garlic, sliced")).toBe("garlic");
    expect(cleanName("finely diced red onion")).toBe("red onion");
    expect(cleanName("boneless skinless chicken thighs (about 2 lb)")).toBe("chicken thighs");
    expect(cleanName("salt to taste")).toBe("salt");
    expect(itemKey("Onions")).toBe(itemKey("diced onion"));
  });
});

describe("adding up amounts", () => {
  it("keeps one unit when they all match", () => {
    expect(amounts("1 cup rice", "1/2 cup rice")).toBe("1 1/2 cups");
    expect(amounts("2 onions", "1 onion")).toBe("3");
    expect(amounts("2 cloves garlic", "3 cloves garlic")).toBe("5 cloves");
  });

  it("converts when units mix, rounding up so you never buy too little", () => {
    expect(amounts("1 cup milk", "4 tbsp milk")).toBe("1 1/4 cups");
    expect(amounts("1 tbsp oil", "1 tsp oil")).toBe("1 1/2 tbsp");
    expect(amounts("1 lb beef", "8 oz beef")).toBe("1 1/2 lb");
    expect(amounts("500 g flour", "1 kg flour")).toBe("1 1/2 kg");
    expect(amounts("200 ml stock", "300 ml stock")).toBe("500 ml");
  });

  it("keeps different kinds apart, and skips 'to taste'", () => {
    expect(amounts("1 can tomatoes", "2 tomatoes")).toBe("2 + 1 can");
    expect(amounts("salt to taste", "1 tsp salt")).toBe("1 tsp");
    expect(amounts("salt to taste")).toBe("");
  });
});

describe("aisles", () => {
  it.each([
    ["red onion", "Produce"],
    ["bell pepper", "Produce"],
    ["pepper", "Spices & oils"],
    ["black pepper", "Spices & oils"],
    ["garlic powder", "Spices & oils"],
    ["olive oil", "Spices & oils"],
    ["ground beef", "Meat & fish"],
    ["chicken thighs", "Meat & fish"],
    ["chicken stock", "Pantry"],
    ["coconut milk", "Pantry"],
    ["peanut butter", "Pantry"],
    ["eggplant", "Produce"],
    ["eggs", "Dairy & eggs"],
    ["feta", "Dairy & eggs"],
    ["frozen peas", "Frozen"],
    ["tortillas", "Bakery"],
    ["spaghetti", "Pantry"],
    ["sumac", "Other"],
  ])("%s goes in %s", (name, aisle) => {
    expect(aisleFor(name)).toBe(aisle);
  });

  it("puts anything in a can on the shelf", () => {
    expect(aisleFor("tomatoes", "can")).toBe("Pantry");
  });
});

describe("the trip's list", () => {
  const pasta = recipe("a", "Lemon pasta", ["200 g spaghetti", "2 lemons", "3 cloves garlic, sliced", "2 tbsp olive oil", "salt to taste"]);
  const chicken = recipe("b", "Lemon chicken", ["4 chicken thighs", "1 lemon", "2 cloves garlic", "1 tbsp olive oil"]);

  it("adds up shared ingredients and says which recipes need them", () => {
    const list = shoppingList([pasta, chicken], [], []);
    const all = list.aisles.flatMap((a) => a.items);
    const lemon = all.find((i) => i.name === "lemons" || i.name === "lemon");
    expect(lemon).toMatchObject({ amount: "3", aisle: "Produce", recipes: ["Lemon pasta", "Lemon chicken"] });
    expect(all.find((i) => i.name === "garlic")?.amount).toBe("5 cloves");
    expect(list.aisles.map((a) => a.aisle)).toEqual(["Produce", "Meat & fish", "Pantry", "Spices & oils"]);
    expect(list.count).toBe(all.length);
  });

  it("sets pantry staples aside, and adds your own items", () => {
    const list = shoppingList([pasta, chicken], ["Paper towels", "sparkling water"], ["salt", "olive oil"]);
    expect(list.staples.map((i) => i.name)).toEqual(["olive oil", "salt"]);
    const extras = list.aisles.flatMap((a) => a.items).filter((i) => i.extra);
    expect(extras.map((i) => [i.name, i.key, i.aisle])).toEqual([
      ["Paper towels", "extra:paper towel", "Other"],
      ["sparkling water", "extra:sparkling water", "Other"],
    ]);
  });

  it("keeps an item's key steady as recipes come and go", () => {
    const one = shoppingList([pasta], [], []).aisles.flatMap((a) => a.items).find((i) => i.name === "garlic");
    const both = shoppingList([pasta, chicken], [], []).aisles.flatMap((a) => a.items).find((i) => i.name === "garlic");
    expect(one?.key).toBe(both?.key);
  });

  it("scales each recipe by how much you're making", () => {
    const all = shoppingList([{ ...pasta, factor: 2 }, chicken], [], []).aisles.flatMap((a) => a.items);
    expect(all.find((i) => i.name === "garlic")?.amount).toBe("8 cloves");
    expect(all.find((i) => i.name === "spaghetti")?.amount).toBe("400 g");
    expect(all.find((i) => i.name === "salt")?.amount).toBe("");
  });
});

describe("trip recipes", () => {
  it("knows how much of each recipe to shop for", async () => {
    const { tripRecipes } = await import("@/lib/model/trip");
    const recipes = [
      { id: "a", servings: 4 },
      { id: "b", servings: null },
      { id: "c", servings: 2 },
    ];
    const out = tripRecipes({ recipeIds: ["a", "b", "gone"], servings: { a: 6, b: 2 } }, recipes);
    expect(out.map((r) => [r.id, r.target, r.factor])).toEqual([
      ["a", 6, 1.5],
      ["b", 2, 2],
    ]);
    expect(tripRecipes({ recipeIds: ["c"] }, recipes)[0]).toMatchObject({ target: 2, factor: 1 });
  });
});
