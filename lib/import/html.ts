import type { ImportDraft } from "./draft";

/**
 * Reading recipe pages. Most recipe sites embed the recipe as schema.org JSON-LD
 * (that's how search engines show recipe cards), so it can be read exactly, with
 * no AI. Pure so it can be tested without the network.
 */

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", frac12: "½", frac14: "¼", frac34: "¾", deg: "°",
  rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"', ndash: "-", mdash: "-", hellip: "...",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi, (m, code: string) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[code.toLowerCase()] ?? m;
  });
}

/** Removes tags and tidies whitespace: "<p>Chop&nbsp;<b>onion</b></p>" -> "Chop onion". */
export function cleanText(s: string): string {
  return decodeEntities(s.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " "))
    .replace(/[ \t ]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

type Json = unknown;

function isRecipe(node: Record<string, unknown>): boolean {
  const t = node["@type"];
  return t === "Recipe" || (Array.isArray(t) && t.includes("Recipe"));
}

/** Depth-first search for the first schema.org Recipe object. */
function findRecipeNode(node: Json, depth = 0): Record<string, unknown> | null {
  if (depth > 8 || node === null || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const hit = findRecipeNode(n, depth + 1);
      if (hit) return hit;
    }
    return null;
  }
  const obj = node as Record<string, unknown>;
  if (isRecipe(obj)) return obj;
  for (const key of ["@graph", "mainEntity", "itemListElement"]) {
    const hit = findRecipeNode(obj[key], depth + 1);
    if (hit) return hit;
  }
  return null;
}

function text(v: Json): string {
  if (typeof v === "string") return cleanText(v);
  if (typeof v === "number") return String(v);
  return "";
}

/** recipeYield comes as 4, "4", "4 servings", "Serves 4-6", or ["4", "4 servings"]. */
export function parseYield(v: Json): number | null {
  const first = Array.isArray(v) ? v.map(text).find((s) => /\d/.test(s)) ?? "" : text(v);
  const m = first.match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = Number(m[1]);
  return n > 0 && n <= 100 ? n : null;
}

/** recipeInstructions: a string, strings, HowToStep objects, or HowToSections of steps. */
export function parseInstructions(v: Json, depth = 0): string[] {
  if (depth > 4 || v == null) return [];
  if (typeof v === "string") return cleanText(v).split("\n").map((s) => s.trim()).filter(Boolean);
  if (Array.isArray(v)) return v.flatMap((x) => parseInstructions(x, depth + 1));
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (o.itemListElement) return parseInstructions(o.itemListElement, depth + 1);
    const t = text(o.text) || text(o.name);
    return t ? [t] : [];
  }
  return [];
}

/** All JSON-LD blocks on a page, parsed. Broken blocks are skipped. */
function jsonLdBlocks(html: string): Json[] {
  const out: Json[] = [];
  const re = /<script[^>]*type=["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi;
  for (const m of html.matchAll(re)) {
    try {
      out.push(JSON.parse(m[1].trim()));
    } catch {
      // Some sites ship invalid JSON-LD; skip it and keep looking.
    }
  }
  return out;
}

/** The recipe a page describes, or null if it doesn't use schema.org markup. */
export function recipeFromHtml(html: string): ImportDraft | null {
  const node = findRecipeNode(jsonLdBlocks(html));
  if (!node) return null;
  const ingredients = (Array.isArray(node.recipeIngredient) ? node.recipeIngredient : [])
    .map(text)
    .filter(Boolean);
  const steps = parseInstructions(node.recipeInstructions);
  const title = text(node.name);
  if (!title && ingredients.length === 0) return null;
  return {
    title,
    servings: parseYield(node.recipeYield),
    ingredients,
    steps,
    notes: "",
  };
}

/** A page's readable text, for when there's no JSON-LD and Claude has to read it. */
export function pageText(html: string, max = 20_000): string {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
  const body = html
    .replace(/<(script|style|noscript|svg|nav|footer|header|form|iframe|title)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  const all = `${cleanText(title)}\n${cleanText(body)}`.replace(/\n{2,}/g, "\n").trim();
  return all.slice(0, max);
}

/** og:description or meta description, which often holds a video's caption. */
export function metaDescription(html: string): string {
  const m =
    html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i) ??
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i);
  return m ? cleanText(m[1]) : "";
}
