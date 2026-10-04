import type { RecipeInput } from "@/lib/model/recipe";

/**
 * What "Fill from link" brings back: a draft for the editor, never a saved
 * recipe. Ingredients and steps are plain lines, the same as typing them in.
 */
export interface ImportDraft {
  title: string;
  servings: number | null;
  ingredients: string[];
  steps: string[];
  notes: string;
}

/** Where a draft came from, so the editor can say how much to trust it. */
export type ImportVia = "page" | "ai";

export type ImportResponse = { draft: ImportDraft; via: ImportVia } | { error: string };

/**
 * Fills the editor's empty fields from a draft. Anything already typed wins,
 * so tapping the button never wipes out your own work. Returns what changed.
 */
export function mergeDraft(form: RecipeInput, draft: ImportDraft): { form: RecipeInput; filled: (keyof RecipeInput)[] } {
  const next = { ...form };
  const filled: (keyof RecipeInput)[] = [];
  const offer: Partial<RecipeInput> = {
    title: draft.title.trim(),
    servings: draft.servings === null ? "" : String(draft.servings),
    ingredients: draft.ingredients.join("\n"),
    steps: draft.steps.join("\n"),
    notes: draft.notes.trim(),
  };
  for (const key of Object.keys(offer) as (keyof RecipeInput)[]) {
    const value = offer[key] ?? "";
    if (value && !next[key].trim()) {
      next[key] = value;
      filled.push(key);
    }
  }
  return { form: next, filled };
}

/** True when a draft has something worth showing. */
export function hasContent(d: ImportDraft): boolean {
  return Boolean(d.title.trim() || d.ingredients.length || d.steps.length);
}
