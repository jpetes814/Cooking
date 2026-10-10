import type { RecipeDoc } from "@/lib/model/recipe";
import { sameThing } from "@/lib/suggest/have";
import { aisleFor, cleanName, itemKey, type Aisle } from "./merge";

/**
 * "Use it up": other recipes that use what a trip is already buying, so the
 * rest of the bunch of cilantro doesn't go to waste. Fresh things (produce,
 * meat, dairy, bread) count double, since those are what spoil. Staples are
 * ignored on both sides. Pure, so it works offline and can be tested.
 */

export const MAX_USE_IT_UP = 3;
const FRESH: ReadonlySet<Aisle> = new Set(["Produce", "Meat & fish", "Dairy & eggs", "Bakery"]);

export type Candidate = Pick<RecipeDoc, "title" | "ingredients" | "rating" | "updatedAt"> & { id: string };

export interface UseItUp<T> {
  recipe: T;
  /** Things already on the list that it uses. */
  shares: string[];
  /** What you'd add to the list for it. */
  adds: string[];
  score: number;
}

/**
 * @param listKeys item keys already on the trip's list (from shoppingList)
 * @param tripIds recipes already on the trip, which aren't suggested again
 */
export function leftoverIdeas<T extends Candidate>(
  recipes: readonly T[],
  listKeys: readonly string[],
  tripIds: readonly string[],
  staples: readonly string[]
): UseItUp<T>[] {
  if (!listKeys.length) return [];
  const onList = new Set(listKeys);
  const isStaple = (name: string) => staples.some((s) => sameThing(s, name));

  const out: UseItUp<T>[] = [];
  for (const r of recipes) {
    if (tripIds.includes(r.id) || !r.ingredients.length) continue;
    const shares: string[] = [];
    const adds: string[] = [];
    let score = 0;
    const seen = new Set<string>();
    for (const ing of r.ingredients) {
      const label = ing.name || ing.raw;
      const key = itemKey(label);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const name = cleanName(label);
      if (isStaple(name)) continue;
      if (onList.has(key)) {
        shares.push(name);
        score += FRESH.has(aisleFor(name, ing.unit)) ? 2 : 1;
      } else {
        adds.push(name);
      }
    }
    if (shares.length) out.push({ recipe: r, shares, adds, score });
  }
  return out
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.adds.length - b.adds.length ||
        (b.recipe.rating ?? 0) - (a.recipe.rating ?? 0) ||
        b.recipe.updatedAt - a.recipe.updatedAt
    )
    .slice(0, MAX_USE_IT_UP);
}

/** "adds 2: rice, chicken" or "nothing else to buy". */
export function addsText(adds: readonly string[]): string {
  if (!adds.length) return "nothing else to buy";
  const shown = adds.slice(0, 3).join(", ");
  return `adds ${adds.length}: ${shown}${adds.length > 3 ? ` and ${adds.length - 3} more` : ""}`;
}
