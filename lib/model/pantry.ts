/**
 * Pantry staples: things you always have, so they can stay off shopping lists.
 * Pure so it can be tested without Firebase.
 */

export const MAX_STAPLES = 300;
export const MAX_STAPLE_LENGTH = 60;

/** Offered as one-tap adds on an empty-ish pantry. */
export const STARTER_STAPLES = [
  "salt",
  "black pepper",
  "olive oil",
  "vegetable oil",
  "butter",
  "garlic",
  "flour",
  "sugar",
  "rice",
  "soy sauce",
] as const;

export interface PantryDoc {
  items: string[];
  updatedAt: number;
}

/** "  Olive   OIL " becomes "olive oil". Empty or too long gives null. */
export function normalizeStaple(raw: string): string | null {
  const v = raw.trim().replace(/\s+/g, " ").toLowerCase();
  if (!v || v.length > MAX_STAPLE_LENGTH) return null;
  return v;
}

export type AddResult = { ok: true; item: string } | { ok: false; error: string };

/** Checks a new staple against the current list before it's saved. */
export function checkNewStaple(items: readonly string[], raw: string): AddResult {
  if (!raw.trim()) return { ok: false, error: "Type something first." };
  const item = normalizeStaple(raw);
  if (!item) return { ok: false, error: `Keep it under ${MAX_STAPLE_LENGTH} letters.` };
  if (items.includes(item)) return { ok: false, error: `${item} is already in your pantry.` };
  if (items.length >= MAX_STAPLES) return { ok: false, error: "Your pantry is full. Remove a few first." };
  return { ok: true, item };
}

/** Starters you haven't added yet. */
export function suggestStaples(items: readonly string[]): string[] {
  return STARTER_STAPLES.filter((s) => !items.includes(s));
}

/** Alphabetical, for display. */
export function sortStaples(items: readonly string[]): string[] {
  return [...items].sort((a, b) => a.localeCompare(b));
}
