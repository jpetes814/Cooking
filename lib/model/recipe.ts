/**
 * Recipes: what's saved, how typed-in text becomes ingredients and steps, and
 * what counts as valid. Pure so it can be tested without Firebase.
 */

export const MAX_TITLE = 120;
export const MAX_INGREDIENTS = 100;
export const MAX_STEPS = 60;
export const MAX_LINE = 500;
export const MAX_NOTES = 4000;
export const MAX_URL = 1000;

export interface Ingredient {
  /** Exactly what was typed, so nothing is ever lost by the parser. */
  raw: string;
  /** 1.5 for "1 1/2". Null for "salt to taste". For "2-3", the low end. */
  qty: number | null;
  /** Normalized ("cup", "tbsp", "g"), or null for "3 eggs". */
  unit: string | null;
  /** What to buy: "onion" from "2 cups diced onion" stays "diced onion" for now. */
  name: string;
}

import type { PhotoMap } from "./photos";

export type SourceKind = "manual" | "link";
export type LinkSite = "tiktok" | "instagram" | "youtube" | "pinterest" | "web";

export interface RecipeDoc {
  title: string;
  source: { kind: SourceKind; url: string | null };
  servings: number | null;
  ingredients: Ingredient[];
  steps: string[];
  tags: string[];
  notes: string;
  /** Keyed by photo id. Missing on recipes saved before photos existed. */
  photos?: PhotoMap;
  createdAt: number;
  updatedAt: number;
}

export type Recipe = RecipeDoc & { id: string; pending: boolean };

/** What the editor hands over. Ingredients and steps are one per line. */
export interface RecipeInput {
  title: string;
  url: string;
  servings: string;
  ingredients: string;
  steps: string;
  notes: string;
}

// ---------- Units ----------

const UNITS: Record<string, string> = {
  cup: "cup", cups: "cup", c: "cup",
  tablespoon: "tbsp", tablespoons: "tbsp", tbsp: "tbsp", tbs: "tbsp", tbl: "tbsp", T: "tbsp",
  teaspoon: "tsp", teaspoons: "tsp", tsp: "tsp", t: "tsp",
  gram: "g", grams: "g", g: "g",
  kilogram: "kg", kilograms: "kg", kg: "kg",
  ounce: "oz", ounces: "oz", oz: "oz",
  pound: "lb", pounds: "lb", lb: "lb", lbs: "lb",
  milliliter: "ml", milliliters: "ml", millilitre: "ml", millilitres: "ml", ml: "ml",
  liter: "l", liters: "l", litre: "l", litres: "l", l: "l",
  clove: "clove", cloves: "clove",
  can: "can", cans: "can",
  pinch: "pinch", pinches: "pinch",
  dash: "dash", dashes: "dash",
  slice: "slice", slices: "slice",
  bunch: "bunch", bunches: "bunch",
  stick: "stick", sticks: "stick",
  package: "package", packages: "package", pkg: "package",
  quart: "quart", quarts: "quart", qt: "quart",
  pint: "pint", pints: "pint", pt: "pint",
  sprig: "sprig", sprigs: "sprig",
  handful: "handful", handfuls: "handful",
};

/** "Tbsp." -> "tbsp". A capital T or lone t keep their classic meaning. */
function unitOf(word: string): string | null {
  const bare = word.replace(/\.$/, "");
  if (bare === "T") return "tbsp";
  return UNITS[bare.toLowerCase()] ?? null;
}

// ---------- Quantities ----------

const UNICODE_FRACTIONS: Record<string, number> = {
  "½": 0.5, "⅓": 1 / 3, "⅔": 2 / 3, "¼": 0.25, "¾": 0.75,
  "⅕": 0.2, "⅖": 0.4, "⅗": 0.6, "⅘": 0.8, "⅙": 1 / 6, "⅚": 5 / 6, "⅛": 0.125, "⅜": 0.375, "⅝": 0.625, "⅞": 0.875,
};

/** One number token: "2", "1.5", "1/2", "½", "1½". */
function numberOf(token: string): number | null {
  if (/^\d+(\.\d+)?$/.test(token)) return Number(token);
  const frac = token.match(/^(\d+)\/(\d+)$/);
  if (frac) return Number(frac[2]) === 0 ? null : Number(frac[1]) / Number(frac[2]);
  const uni = token.match(/^(\d*)([½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])$/);
  if (uni) return (uni[1] ? Number(uni[1]) : 0) + UNICODE_FRACTIONS[uni[2]];
  return null;
}

/** Rounds away float noise: 1/3 + 1 stays 1.333, not 1.3333333333. */
function tidy(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * Reads the quantity off the front of a line. Handles "2", "1 1/2", "1½",
 * "2-3" and "2 to 3" (low end). Returns the quantity and the words after it.
 */
function leadingQty(words: string[]): { qty: number | null; rest: string[] } {
  if (words.length === 0) return { qty: null, rest: words };

  // "2-3" or "2–3" as one token.
  const range = words[0].match(/^([\d./½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]+)[-–]([\d./½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]+)$/);
  if (range) {
    const low = numberOf(range[1]);
    if (low !== null) return { qty: tidy(low), rest: words.slice(1) };
  }

  const first = numberOf(words[0]);
  if (first === null) return { qty: null, rest: words };

  // "1 1/2": a whole number followed by a fraction.
  const second = words[1] !== undefined ? numberOf(words[1]) : null;
  if (second !== null && second < 1 && Number.isInteger(first) && /[/½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]/.test(words[1])) {
    return { qty: tidy(first + second), rest: words.slice(2) };
  }
  // "2 to 3" or "2 - 3": keep the low end.
  if ((words[1] === "to" || words[1] === "-" || words[1] === "–") && words[2] !== undefined && numberOf(words[2]) !== null) {
    return { qty: tidy(first), rest: words.slice(3) };
  }
  return { qty: tidy(first), rest: words.slice(1) };
}

// ---------- Lines ----------

/** Strips list markers people paste in: "- ", "• ", "* ", "1. ", "2) ", "Step 3:". */
export function stripMarker(line: string): string {
  return line
    .replace(/^\s*(?:[-•*·▪◦]|\d{1,3}[.)]|step\s*\d{1,3}\s*[:.)-]?)\s+/i, "")
    .trim();
}

/** One entry per non-empty line, markers removed, overlong lines cut. */
export function splitLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map(stripMarker)
    .filter(Boolean)
    .map((l) => l.slice(0, MAX_LINE));
}

/** "2 cups diced onion" -> { qty: 2, unit: "cup", name: "diced onion" }. */
export function parseIngredient(line: string): Ingredient {
  const raw = stripMarker(line).slice(0, MAX_LINE);
  const words = raw.split(/\s+/).filter(Boolean);
  const { qty, rest } = leadingQty(words);

  let unit: string | null = null;
  let nameWords = rest;
  if (qty !== null && rest.length > 1) {
    const u = unitOf(rest[0]);
    if (u) {
      unit = u;
      nameWords = rest.slice(1);
    }
  }
  // "2 cups of flour" -> "flour".
  if (unit && nameWords[0]?.toLowerCase() === "of" && nameWords.length > 1) nameWords = nameWords.slice(1);

  const name = nameWords.join(" ").replace(/^,\s*/, "").trim() || raw;
  return { raw, qty, unit, name };
}

/** "1.5" -> "1 1/2", "0.333" -> "1/3": friendlier for cooking. */
export function formatQty(qty: number): string {
  const whole = Math.floor(qty);
  const frac = qty - whole;
  const nice: [number, string][] = [
    [1 / 8, "1/8"], [1 / 4, "1/4"], [1 / 3, "1/3"], [3 / 8, "3/8"], [1 / 2, "1/2"],
    [5 / 8, "5/8"], [2 / 3, "2/3"], [3 / 4, "3/4"], [7 / 8, "7/8"],
  ];
  if (frac < 0.01) return String(whole);
  const match = nice.find(([v]) => Math.abs(v - frac) < 0.01);
  if (!match) return String(tidy(qty));
  return whole ? `${whole} ${match[1]}` : match[1];
}

/** Abbreviations stay as they are; words get an "s" past one ("2 cups", "1/2 cup"). */
const ABBREVIATED = new Set(["tbsp", "tsp", "g", "kg", "oz", "lb", "ml", "l", "qt", "pt"]);
const PLURALS: Record<string, string> = { pinch: "pinches", dash: "dashes", bunch: "bunches" };

export function unitLabel(unit: string, qty: number | null): string {
  if (ABBREVIATED.has(unit) || qty === null || qty <= 1) return unit;
  return PLURALS[unit] ?? `${unit}s`;
}

/** "1 1/2 cups", "3 cloves", "2 tbsp", or just "3" when there's no unit. */
export function formatAmount(ing: Pick<Ingredient, "qty" | "unit">): string {
  if (ing.qty === null) return "";
  return ing.unit ? `${formatQty(ing.qty)} ${unitLabel(ing.unit, ing.qty)}` : formatQty(ing.qty);
}

// ---------- Links ----------

/** A pasted link, checked and labeled. Bare "tiktok.com/..." gets https added. */
export function parseLink(raw: string): { ok: true; url: string; site: LinkSite } | { ok: false; error: string } {
  const text = raw.trim();
  if (!text) return { ok: false, error: "Paste a link first." };
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`);
  } catch {
    return { ok: false, error: "That doesn't look like a link." };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return { ok: false, error: "That doesn't look like a link." };
  if (!url.hostname.includes(".")) return { ok: false, error: "That doesn't look like a link." };
  const href = url.toString();
  if (href.length > MAX_URL) return { ok: false, error: "That link is too long." };
  return { ok: true, url: href, site: siteOf(url.hostname) };
}

export function siteOf(hostname: string): LinkSite {
  const h = hostname.toLowerCase().replace(/^www\./, "").replace(/^m\./, "");
  if (h === "tiktok.com" || h.endsWith(".tiktok.com")) return "tiktok";
  if (h === "instagram.com" || h.endsWith(".instagram.com")) return "instagram";
  if (h === "youtube.com" || h.endsWith(".youtube.com") || h === "youtu.be") return "youtube";
  if (h === "pinterest.com" || h.endsWith(".pinterest.com") || h === "pin.it") return "pinterest";
  return "web";
}

export const SITE_LABEL: Record<LinkSite, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  youtube: "YouTube",
  pinterest: "Pinterest",
  web: "the web",
};

// ---------- Building and editing ----------

export type BuildResult = { ok: true; recipe: RecipeDoc } | { ok: false; error: string };

/**
 * Turns the editor's fields into a recipe ready to save. A link on its own is
 * fine (that's how most video recipes start); the title is the only must.
 */
export function buildRecipe(input: RecipeInput, now: number, existing?: RecipeDoc): BuildResult {
  const title = input.title.trim().replace(/\s+/g, " ");
  if (!title) return { ok: false, error: "Give it a name." };
  if (title.length > MAX_TITLE) return { ok: false, error: `Keep the name under ${MAX_TITLE} letters.` };

  let url: string | null = null;
  if (input.url.trim()) {
    const link = parseLink(input.url);
    if (!link.ok) return link;
    url = link.url;
  }

  let servings: number | null = null;
  if (input.servings.trim()) {
    const n = Number(input.servings.trim());
    if (!Number.isFinite(n) || n <= 0 || n > 100) return { ok: false, error: "Servings should be a number from 1 to 100." };
    servings = tidy(n);
  }

  const ingredients = splitLines(input.ingredients).map(parseIngredient);
  if (ingredients.length > MAX_INGREDIENTS) return { ok: false, error: `That's more than ${MAX_INGREDIENTS} ingredients.` };
  const steps = splitLines(input.steps);
  if (steps.length > MAX_STEPS) return { ok: false, error: `That's more than ${MAX_STEPS} steps.` };
  const notes = input.notes.trim();
  if (notes.length > MAX_NOTES) return { ok: false, error: "The notes are too long." };

  return {
    ok: true,
    recipe: {
      title,
      source: { kind: url ? "link" : "manual", url },
      servings,
      ingredients,
      steps,
      tags: existing?.tags ?? [],
      photos: existing?.photos ?? {},
      notes,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    },
  };
}

/** The editor's fields for an existing recipe (or a blank one). */
export function toInput(recipe?: RecipeDoc): RecipeInput {
  if (!recipe) return { title: "", url: "", servings: "", ingredients: "", steps: "", notes: "" };
  return {
    title: recipe.title,
    url: recipe.source.url ?? "",
    servings: recipe.servings === null ? "" : String(recipe.servings),
    ingredients: recipe.ingredients.map((i) => i.raw).join("\n"),
    steps: recipe.steps.join("\n"),
    notes: recipe.notes,
  };
}

/** Newest first. */
export function sortRecipes<T extends Pick<RecipeDoc, "updatedAt" | "title">>(list: readonly T[]): T[] {
  return [...list].sort((a, b) => b.updatedAt - a.updatedAt || a.title.localeCompare(b.title));
}
