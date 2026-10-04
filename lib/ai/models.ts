/**
 * Every Claude model ID used by the app lives here, so swapping one is a
 * one-line change. Pick by job, not by route.
 */
export const MODELS = {
  /** Reading recipe text (captions, pages, photos) into a structured draft. */
  reader: "claude-opus-5-5",
} as const;

export type ModelRole = keyof typeof MODELS;

/** Roles whose models support server-side refusal fallbacks (`fallbacks: "default"`). */
export const FALLBACK_ROLES: ReadonlySet<ModelRole> = new Set(["reader"]);
