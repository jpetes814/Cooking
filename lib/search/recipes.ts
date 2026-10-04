import type { RecipeDoc } from "@/lib/model/recipe";
import { tagMatches } from "./tags";

/**
 * Finding recipes. Type words or ingredients ("chicken lemon", or
 * "chicken thighs, lemon" to keep phrases together) and every one has to show
 * up somewhere: the name, a tag, an ingredient, or the notes. Picked tag
 * filters must all match too. Plurals are forgiven: "soups" finds "soup".
 */

export interface RecipeFilter {
  query: string;
  tags: string[];
}

/** "tomatoes" -> "tomato", "berries" -> "berry", "soups" -> "soup". Good enough for searching. */
export function stem(word: string): string {
  if (word.length > 4 && word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.length > 4 && /(oes|ches|shes|sses|xes)$/.test(word)) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9/ -]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map(stem)
    .join(" ");
}

/** Search terms: commas keep phrases together, otherwise each word counts on its own. */
export function parseQuery(query: string): string[] {
  const chunks = query.includes(",") ? query.split(",") : query.split(/\s+/);
  return chunks.map(normalize).filter(Boolean);
}

/** Everything searchable about a recipe, normalized once. */
export function searchText(r: Pick<RecipeDoc, "title" | "tags" | "ingredients" | "notes">): string {
  return ` ${normalize([r.title, r.tags.join(" ").replace(/\//g, " "), r.ingredients.map((i) => i.name).join(" "), r.notes].join(" "))} `;
}

export function matchesFilter(r: Pick<RecipeDoc, "title" | "tags" | "ingredients" | "notes">, filter: RecipeFilter, text = searchText(r)): boolean {
  if (!filter.tags.every((f) => r.tags.some((t) => tagMatches(f, t)))) return false;
  // Matches the start of a word, so results update usefully while typing ("tom" finds "tomato").
  return parseQuery(filter.query).every((term) => text.includes(` ${term}`));
}

export function filterRecipes<T extends Pick<RecipeDoc, "title" | "tags" | "ingredients" | "notes">>(list: readonly T[], filter: RecipeFilter): T[] {
  if (!filter.query.trim() && filter.tags.length === 0) return [...list];
  return list.filter((r) => matchesFilter(r, filter));
}
