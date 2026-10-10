import type { Ingredient, RecipeDoc } from "./recipe";

/**
 * Making more or less of a recipe. When a recipe says how many it serves, you
 * pick a number of servings; otherwise you pick a multiplier (½×, 2×). Only
 * the amounts change, never the saved recipe. Pure so it can be tested.
 */

export const MAX_SERVINGS = 50;
const MULTIPLIERS = [0.25, 0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10];

/** How much to multiply amounts by. Target is servings when the recipe has them, else a multiplier. */
export function scaleFactor(base: number | null, target: number | null | undefined): number {
  if (!target || target <= 0) return 1;
  return base && base > 0 ? target / base : target;
}

/** The starting point: the recipe's own servings, or 1×. */
export function defaultTarget(base: number | null): number {
  return base && base > 0 ? base : 1;
}

/** One tap of − or +. Whole servings from 1 to 50, or the next multiplier. */
export function stepTarget(current: number, dir: 1 | -1, base: number | null): number {
  if (base && base > 0) {
    const next = dir === 1 ? Math.floor(current + 1) : Math.ceil(current - 1);
    return Math.min(MAX_SERVINGS, Math.max(1, next));
  }
  const i = MULTIPLIERS.findIndex((m) => m >= current - 1e-9);
  const at = i === -1 ? MULTIPLIERS.length - 1 : i;
  const exact = MULTIPLIERS[at] === current;
  const nextIndex = dir === 1 ? (exact ? at + 1 : at) : at - 1;
  return MULTIPLIERS[Math.min(MULTIPLIERS.length - 1, Math.max(0, nextIndex))];
}

export function canStep(current: number, dir: 1 | -1, base: number | null): boolean {
  return stepTarget(current, dir, base) !== current;
}

/** Amounts scaled; "to taste" lines stay as they are. */
export function scaleIngredient<T extends Pick<Ingredient, "qty">>(ing: T, factor: number): T {
  if (ing.qty === null || factor === 1) return ing;
  return { ...ing, qty: ing.qty * factor };
}

/** "Serves 2" or "2×", for labels. */
export function targetLabel(target: number, base: number | null): string {
  if (base && base > 0) return `Serves ${target}`;
  const nice: Record<number, string> = { 0.25: "¼", 0.5: "½", 1.5: "1½" };
  return `${nice[target] ?? target}×`;
}

export type Scalable = Pick<RecipeDoc, "servings" | "ingredients">;

/** The recipe's ingredients at this target. */
export function scaledIngredients(r: Scalable, target: number | null | undefined): Ingredient[] {
  const f = scaleFactor(r.servings, target);
  return r.ingredients.map((i) => scaleIngredient(i, f));
}
