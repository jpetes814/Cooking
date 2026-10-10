import type { RecipeDoc } from "@/lib/model/recipe";
import { normalize } from "@/lib/search/recipes";
import { fitsTime, isEasy, usesMethod, type Method, type TimeLimit } from "@/lib/search/tags";

/**
 * "What can I make?": which of your recipes use the things you have. Matches
 * ingredient names loosely ("chicken" counts for "boneless chicken thighs",
 * "red onions" for "onion"), and pantry staples count as things you have.
 * Pure so it works offline and can be tested.
 */

export const MAX_HAVE = 20;
export const MAX_HAVE_LENGTH = 40;

export type Matchable = Pick<RecipeDoc, "title" | "ingredients" | "tags" | "rating" | "updatedAt">;

/** Optional narrowing: how you want to cook it, how long you have, and whether it should be easy. */
export interface HaveFilters {
  method: Method | null;
  time: TimeLimit | null;
  easy: boolean;
}

export const NO_FILTERS: HaveFilters = { method: null, time: null, easy: false };

export function filtersOn(f: HaveFilters): boolean {
  return f.method !== null || f.time !== null || f.easy;
}

/** Recipes tagged to fit the filters. Untagged recipes drop out while a filter is on. */
export function fitsFilters(tags: readonly string[], f: HaveFilters): boolean {
  if (f.method && !usesMethod(tags, f.method)) return false;
  if (f.time && !fitsTime(tags, f.time)) return false;
  if (f.easy && !isEasy(tags)) return false;
  return true;
}

export interface HaveMatch<T> {
  recipe: T;
  /** Your items it uses, as you typed them. */
  uses: string[];
  /** Ingredients you'd still need, as the recipe names them. */
  missing: string[];
  /** Share of the recipe's ingredients you have, 0 to 1. */
  covered: number;
}

/** "Chicken, lemons ,  " becomes ["chicken", "lemons"]. Tidied, no repeats, within limits. */
export function splitHave(raw: string, current: readonly string[] = []): string[] {
  const out = [...current];
  for (const part of raw.split(/[,\n]/)) {
    const item = part.trim().replace(/\s+/g, " ").toLowerCase();
    if (!item || item.length > MAX_HAVE_LENGTH || out.length >= MAX_HAVE) continue;
    if (!out.some((o) => normalize(o) === normalize(item))) out.push(item);
  }
  return out;
}

const padded = (s: string) => ` ${normalize(s)} `;

/** True when one names the other: every word of the shorter is in the longer, in order. */
function sameThing(have: string, ingredient: string): boolean {
  const h = padded(have);
  const i = padded(ingredient);
  if (h.trim() === "" || i.trim() === "") return false;
  return i.includes(h) || h.includes(i);
}

export function matchRecipe<T extends Matchable>(recipe: T, have: readonly string[], staples: readonly string[]): HaveMatch<T> | null {
  if (!recipe.ingredients.length || !have.length) return null;
  const uses = have.filter((h) => recipe.ingredients.some((ing) => sameThing(h, ing.name || ing.raw)));
  if (!uses.length) return null;
  const all = [...have, ...staples];
  const missing = recipe.ingredients
    .map((ing) => ing.name || ing.raw)
    .filter((name) => !all.some((h) => sameThing(h, name)));
  const covered = (recipe.ingredients.length - missing.length) / recipe.ingredients.length;
  return { recipe, uses, missing, covered };
}

/** Recipes that use the most of what you have first, then the ones you're closest to making. */
export function whatCanIMake<T extends Matchable>(
  recipes: readonly T[],
  have: readonly string[],
  staples: readonly string[] = [],
  filters: HaveFilters = NO_FILTERS
): HaveMatch<T>[] {
  return recipes
    .filter((r) => fitsFilters(r.tags, filters))
    .map((r) => matchRecipe(r, have, staples))
    .filter((m): m is HaveMatch<T> => m !== null)
    .sort(
      (a, b) =>
        b.uses.length - a.uses.length ||
        a.missing.length - b.missing.length ||
        (b.recipe.rating ?? 0) - (a.recipe.rating ?? 0) ||
        b.recipe.updatedAt - a.recipe.updatedAt
    );
}

/** "missing 2: feta, dill", or "you have everything". Long lists end with "and N more". */
export function missingText(missing: readonly string[]): string {
  if (!missing.length) return "you have everything";
  const shown = missing.slice(0, 3).join(", ");
  const more = missing.length > 3 ? ` and ${missing.length - 3} more` : "";
  return `missing ${missing.length}: ${shown}${more}`;
}
