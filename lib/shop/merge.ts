import { formatQty, unitLabel, type Ingredient, type RecipeDoc } from "@/lib/model/recipe";
import { normalize } from "@/lib/search/recipes";
import { sameThing } from "@/lib/suggest/have";

/**
 * One shopping list from several recipes: the same ingredient is added up
 * (converting cups and tablespoons, or ounces and pounds, when they mix),
 * grouped by aisle, with pantry staples set aside. Pure, so the list works in
 * the store with no signal and can be tested.
 */

export const AISLES = ["Produce", "Meat & fish", "Dairy & eggs", "Bakery", "Pantry", "Spices & oils", "Frozen", "Other"] as const;
export type Aisle = (typeof AISLES)[number];

export interface ShopItem {
  /** Stable id for checking it off: the same item keeps the same key as recipes come and go. */
  key: string;
  name: string;
  /** "2 1/2 cups + 1 can", or "" when the recipes don't say how much. */
  amount: string;
  aisle: Aisle;
  /** Which recipes need it. */
  recipes: string[];
  /** Typed in on the trip rather than from a recipe. */
  extra: boolean;
}

export interface ShopList {
  aisles: { aisle: Aisle; items: ShopItem[] }[];
  /** Things the recipes need that are on your pantry list, so you probably have them. */
  staples: ShopItem[];
  count: number;
}

// ---------- Names ----------

const PREP = new Set(
  "diced chopped minced sliced grated shredded crushed fresh freshly finely roughly coarsely thinly thickly large small medium ripe peeled cooked softened melted beaten cubed halved quartered trimmed rinsed drained packed heaping level boneless skinless whole optional".split(
    " "
  )
);

/** "garlic, sliced" -> "garlic"; "2 large ripe tomatoes (about 1 lb)" style names -> "tomatoes". */
export function cleanName(name: string): string {
  const cut = name
    .toLowerCase()
    .split(/[,(;]/)[0]
    .replace(/\b(to taste|for garnish|for serving|as needed|plus more.*|or more.*)$/g, "")
    .trim();
  const words = cut.split(/\s+/).filter((w) => w && !PREP.has(w));
  return (words.join(" ") || cut).trim();
}

export function itemKey(name: string): string {
  return normalize(cleanName(name));
}

// ---------- Amounts ----------

const CUP = 236.6;
// Spoons as exact parts of a cup, so 1 cup plus 4 tbsp comes to exactly 1 1/4 cups.
const VOLUME_ML: Record<string, number> = { tsp: CUP / 48, tbsp: CUP / 16, cup: CUP, ml: 1, l: 1000, pint: CUP * 2, quart: CUP * 4 };
const WEIGHT_G: Record<string, number> = { g: 1, kg: 1000, oz: 28.35, lb: 453.6 };

/** Rounds up to a friendly fraction (quarters), so you never buy too little. */
function roundUp(n: number, step = 0.25): number {
  return Math.ceil(n / step - 1e-3) * step;
}

function show(qty: number, unit: string | null): string {
  return unit ? `${formatQty(qty)} ${unitLabel(unit, qty)}` : formatQty(qty);
}

function volumeText(ml: number, units: Set<string>): string {
  if (units.size === 1) {
    const [u] = units;
    return show(roundUp(ml / VOLUME_ML[u], u === "ml" ? 1 : 0.25), u);
  }
  if ([...units].every((u) => u === "ml" || u === "l")) return ml >= 1000 ? show(roundUp(ml / 1000), "l") : show(Math.ceil(ml), "ml");
  if (ml >= VOLUME_ML.cup / 4) return show(roundUp(ml / VOLUME_ML.cup), "cup");
  if (ml >= VOLUME_ML.tbsp) return show(roundUp(ml / VOLUME_ML.tbsp, 0.5), "tbsp");
  return show(roundUp(ml / VOLUME_ML.tsp), "tsp");
}

function weightText(g: number, units: Set<string>): string {
  if (units.size === 1) {
    const [u] = units;
    return show(roundUp(g / WEIGHT_G[u], u === "g" ? 1 : 0.25), u);
  }
  if ([...units].every((u) => u === "g" || u === "kg")) return g >= 1000 ? show(roundUp(g / 1000), "kg") : show(Math.ceil(g), "g");
  return g >= WEIGHT_G.lb ? show(roundUp(g / WEIGHT_G.lb), "lb") : show(roundUp(g / WEIGHT_G.oz), "oz");
}

/** Adds up one ingredient's amounts across recipes. Different kinds stay separate: "2 cups + 1 can". */
export function addAmounts(parts: readonly Pick<Ingredient, "qty" | "unit">[]): string {
  let ml = 0;
  let g = 0;
  const volUnits = new Set<string>();
  const wtUnits = new Set<string>();
  const other = new Map<string, number>();
  let count = 0;
  for (const p of parts) {
    if (p.qty === null) continue;
    if (p.unit && VOLUME_ML[p.unit]) {
      ml += p.qty * VOLUME_ML[p.unit];
      volUnits.add(p.unit);
    } else if (p.unit && WEIGHT_G[p.unit]) {
      g += p.qty * WEIGHT_G[p.unit];
      wtUnits.add(p.unit);
    } else if (p.unit) {
      other.set(p.unit, (other.get(p.unit) ?? 0) + p.qty);
    } else {
      count += p.qty;
    }
  }
  const out: string[] = [];
  if (count) out.push(formatQty(roundUp(count, 0.5)));
  if (ml) out.push(volumeText(ml, volUnits));
  if (g) out.push(weightText(g, wtUnits));
  for (const [u, q] of other) out.push(show(roundUp(q, 0.5), u));
  return out.join(" + ");
}

// ---------- Aisles ----------

// Checked in this order, so "chicken stock" is on the shelf, "ground beef" at the meat counter,
// and "garlic powder" with the spices. Words match whole, with a plural allowed.
const AISLE_WORDS: [Aisle, string[]][] = [
  ["Frozen", ["frozen", "ice cream"]],
  ["Pantry", ["stock", "broth", "bouillon", "paste", "sauce", "canned", "coconut", "peanut butter", "nut butter", "breadcrumb"]],
  ["Meat & fish", ["chicken", "beef", "pork", "lamb", "turkey", "sausage", "bacon", "ham", "steak", "mince", "salmon", "fish", "cod", "shrimp", "prawn", "chorizo", "thigh", "wing", "drumstick"]],
  ["Dairy & eggs", ["milk", "buttermilk", "butter", "cheese", "cream", "yogurt", "yoghurt", "egg", "feta", "parmesan", "mozzarella", "ricotta", "cheddar", "tofu", "halloumi"]],
  [
    "Spices & oils",
    ["salt", "black pepper", "white pepper", "peppercorn", "cumin", "paprika", "cinnamon", "nutmeg", "powder", "pepper flake", "chili flake", "oregano", "dried", "ground", "bay leaf", "bay leaves", "turmeric", "garam masala", "vanilla", "oil", "vinegar", "baking soda", "spice", "seasoning"],
  ],
  ["Bakery", ["bread", "tortilla", "bun", "pita", "baguette", "naan", "roll", "bagel", "croissant", "puff pastry"]],
  [
    "Pantry",
    ["flour", "sugar", "rice", "pasta", "spaghetti", "noodle", "orzo", "gnocchi", "bean", "lentil", "chickpea", "honey", "syrup", "oats", "quinoa", "couscous", "nut", "almond", "peanut", "tuna", "cornstarch", "chocolate", "cocoa", "jam", "mustard", "mayo", "ketchup", "wine", "raisin"],
  ],
  [
    "Produce",
    ["onion", "garlic", "lemon", "lime", "orange", "tomato", "potato", "sweet potato", "carrot", "celery", "bell pepper", "red pepper", "green pepper", "jalapeno", "chili", "spinach", "lettuce", "kale", "arugula", "cilantro", "parsley", "basil", "dill", "mint", "rosemary", "thyme", "sage", "ginger", "avocado", "apple", "banana", "berry", "berries", "cherries", "mushroom", "zucchini", "cucumber", "cabbage", "broccoli", "cauliflower", "scallion", "shallot", "leek", "squash", "pumpkin", "corn", "pea", "green bean", "asparagus", "eggplant", "beet", "radish", "fruit", "grape", "peach", "pear", "mango", "pineapple", "herb", "greens"],
  ],
];

/** Where it's likely to be in the store. A guess from its name; "Other" when unsure. */
export function aisleFor(name: string, unit: string | null = null): Aisle {
  const n = ` ${cleanName(name)} `;
  // A can of anything is on the canned goods shelf.
  if (unit === "can") return "Pantry";
  // Plain "pepper" in a recipe means the ground kind; bell peppers say so.
  if (n === " pepper " || n === " peppers ") return "Spices & oils";
  for (const [aisle, words] of AISLE_WORDS) {
    if (words.some((w) => new RegExp(`[^a-z]${w}(s|es)?[^a-z]`).test(n))) return aisle;
  }
  return "Other";
}

// ---------- The list ----------

export type Shoppable = Pick<RecipeDoc, "title" | "ingredients"> & { id: string };

export function shoppingList(recipes: readonly Shoppable[], extras: readonly string[], staples: readonly string[]): ShopList {
  const byKey = new Map<string, { name: string; parts: Ingredient[]; recipes: string[]; unit: string | null }>();
  for (const r of recipes) {
    for (const ing of r.ingredients) {
      const label = ing.name || ing.raw;
      const key = itemKey(label);
      if (!key) continue;
      const entry = byKey.get(key) ?? { name: cleanName(label), parts: [], recipes: [], unit: ing.unit };
      entry.parts.push(ing);
      if (!entry.recipes.includes(r.title)) entry.recipes.push(r.title);
      byKey.set(key, entry);
    }
  }

  const items: ShopItem[] = [...byKey].map(([key, e]) => ({
    key,
    name: e.name,
    amount: addAmounts(e.parts),
    aisle: aisleFor(e.name, e.unit),
    recipes: e.recipes,
    extra: false,
  }));
  for (const x of extras) {
    const key = `extra:${normalize(x)}`;
    if (items.some((i) => i.key === key)) continue;
    items.push({ key, name: x, amount: "", aisle: aisleFor(x), recipes: [], extra: true });
  }

  const isStaple = (i: ShopItem) => !i.extra && staples.some((s) => sameThing(s, i.name));
  const toBuy = items.filter((i) => !isStaple(i));
  const byName = (a: ShopItem, b: ShopItem) => a.name.localeCompare(b.name);
  return {
    aisles: AISLES.map((aisle) => ({ aisle, items: toBuy.filter((i) => i.aisle === aisle).sort(byName) })).filter((a) => a.items.length),
    staples: items.filter(isStaple).sort(byName),
    count: toBuy.length,
  };
}
