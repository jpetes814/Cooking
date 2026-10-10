import { defaultTarget, scaleFactor } from "./scale";

/**
 * A shopping trip: which recipes it's for, what's been checked off, and any
 * extra items typed in. The list itself is worked out on the phone from the
 * recipes (lib/shop/merge.ts), so it stays right if a recipe changes. Pure.
 */

export const MAX_TRIP_NAME = 80;
export const MAX_TRIP_RECIPES = 50;
export const MAX_EXTRAS = 100;
export const MAX_EXTRA_LENGTH = 80;
export const MAX_CHECKED = 600;

export interface TripDoc {
  name: string;
  recipeIds: string[];
  /** Item keys that are in the cart. A map, so two phones checking things off merge cleanly. */
  checked: Record<string, true>;
  extras: string[];
  /** Per recipe: servings to shop for, or a multiplier when it doesn't say. Missing means as written. */
  servings?: Record<string, number>;
  createdAt: number;
  updatedAt: number;
}

export type Trip = TripDoc & { id: string; pending: boolean };

/** The trip's recipes with how much to make of each, ready for the shopping list. */
export function tripRecipes<R extends { id: string; servings: number | null }>(
  trip: Pick<TripDoc, "recipeIds" | "servings">,
  recipes: readonly R[]
): (R & { factor: number; target: number })[] {
  return trip.recipeIds
    .map((id) => recipes.find((r) => r.id === id))
    .filter((r): r is R => r !== undefined)
    .map((r) => {
      const target = trip.servings?.[r.id] ?? defaultTarget(r.servings);
      return { ...r, target, factor: scaleFactor(r.servings, target) };
    });
}

/** "Trip for Sat, Oct 10" */
export function defaultTripName(now: number): string {
  return `Trip for ${new Date(now).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}`;
}

export function newTrip(name: string, recipeIds: readonly string[], now: number): TripDoc {
  return {
    name: name.trim().replace(/\s+/g, " ").slice(0, MAX_TRIP_NAME) || defaultTripName(now),
    recipeIds: [...new Set(recipeIds)].slice(0, MAX_TRIP_RECIPES),
    checked: {},
    extras: [],
    createdAt: now,
    updatedAt: now,
  };
}

/** A typed-in item, tidied. Null if empty, too long, or already on the trip. */
export function tidyExtra(raw: string, extras: readonly string[]): string | null {
  const item = raw.trim().replace(/\s+/g, " ");
  if (!item || item.length > MAX_EXTRA_LENGTH || extras.length >= MAX_EXTRAS) return null;
  if (extras.some((x) => x.toLowerCase() === item.toLowerCase())) return null;
  return item;
}

/** How many of these items are checked off. Keys from removed recipes don't count. */
export function progress(keys: readonly string[], checked: Record<string, true>): { done: number; left: number } {
  const done = keys.filter((k) => checked[k]).length;
  return { done, left: keys.length - done };
}
