import type { RecipeDoc } from "./recipe";

/**
 * The "check it before saving" step: things in a recipe worth a second look,
 * especially after Claude filled it in. Pure so it can be tested.
 */

export interface ReviewNote {
  kind: "ai" | "amount" | "missing";
  text: string;
}

// Lines that are fine without an amount.
const NO_AMOUNT_OK = /\b(to taste|as needed|for serving|for garnish|optional|a pinch|pinch of|a dash|handful|some)\b/i;

/** Ingredients with no amount, leaving out ones that never have one ("salt to taste"). */
export function missingAmounts(r: Pick<RecipeDoc, "ingredients">): string[] {
  return r.ingredients.filter((i) => i.qty === null && !NO_AMOUNT_OK.test(i.raw)).map((i) => i.raw);
}

export function reviewNotes(
  r: Pick<RecipeDoc, "ingredients" | "steps" | "tags">,
  opts: { filledByClaude: boolean; claudeTags: readonly string[] }
): ReviewNote[] {
  const notes: ReviewNote[] = [];
  if (opts.filledByClaude) {
    notes.push({ kind: "ai", text: "Claude filled this in. Compare the amounts and steps with the photo or link." });
  }
  const fromClaude = r.tags.filter((t) => opts.claudeTags.includes(t));
  if (fromClaude.length) {
    notes.push({
      kind: "ai",
      text: `${fromClaude.length === 1 ? "1 tag was" : `${fromClaude.length} tags were`} suggested by Claude.`,
    });
  }
  const missing = missingAmounts(r);
  if (missing.length) {
    notes.push({
      kind: "amount",
      text: `No amount on ${missing.length === 1 ? "1 ingredient" : `${missing.length} ingredients`}: ${missing.slice(0, 3).join(", ")}${missing.length > 3 ? ` and ${missing.length - 3} more` : ""}.`,
    });
  }
  if (!r.ingredients.length) notes.push({ kind: "missing", text: "No ingredients yet." });
  if (!r.steps.length) notes.push({ kind: "missing", text: "No steps yet." });
  return notes;
}
