import { lastCooked } from "@/lib/model/cooking";
import type { RecipeDoc } from "@/lib/model/recipe";
import { tagLeaf } from "@/lib/search/tags";
import type { WeatherMood } from "./weather";

/**
 * "Ideas for tonight": a few recipes from your own box, picked from what you
 * rate well, what's in season, what you haven't made lately, and (if you turn
 * it on) the weather. Pure, so it works offline and can be tested.
 */

export type Season = "spring" | "summer" | "fall" | "winter";

export type Suggestible = Pick<RecipeDoc, "title" | "tags" | "rating" | "cooked" | "createdAt" | "updatedAt">;

export interface IdeasContext {
  now: number;
  season: Season;
  weather?: WeatherMood | null;
}

export const IDEAS_PER_PAGE = 3;
/** Shuffle goes through this many of the best, so it never lands on the ones you rated low. */
const POOL = 12;
const DAY = 24 * 60 * 60 * 1000;

const OPPOSITE: Record<Season, Season> = { summer: "winter", winter: "summer", spring: "fall", fall: "spring" };
const COZY = ["soup", "stew", "curry", "chili", "casserole", "baking", "bake", "roast", "braise", "slow-cooker", "pot pie", "comfort", "ramen", "pho"];
const FRESH = ["salad", "bowl", "no-cook", "grill", "grilled", "cold", "chilled", "gazpacho", "poke", "ceviche", "smoothie", "summer rolls"];

/** Tags that show up on the recipes you rate 4 or 5 stars or keep making. Seasons aside. */
export function likedTags(recipes: readonly Suggestible[]): Map<string, number> {
  const liked = new Map<string, number>();
  for (const r of recipes) {
    if (!loved(r)) continue;
    for (const t of r.tags) if (!t.startsWith("season/")) liked.set(t, (liked.get(t) ?? 0) + 1);
  }
  return liked;
}

function loved(r: Suggestible): boolean {
  return (r.rating ?? 0) >= 4 || (r.cooked?.length ?? 0) >= 2;
}

function mentions(r: Suggestible, words: readonly string[]): boolean {
  const text = ` ${[r.title, ...r.tags.map(tagLeaf)].join(" ").toLowerCase()} `;
  return words.some((w) => new RegExp(`[^a-z]${w.replace("-", "[- ]?")}(e?s)?[^a-z]`).test(text));
}

function weeksText(days: number): string {
  if (days < 60) return `${Math.round(days / 7)} weeks`;
  if (days < 365) return `${Math.round(days / 30)} months`;
  return "over a year";
}

export interface Scored<T> {
  recipe: T;
  score: number;
  /** Why it was picked, most important first. */
  reasons: string[];
}

export function scoreRecipe<T extends Suggestible>(r: T, ctx: IdeasContext, liked: Map<string, number>): Scored<T> {
  const parts: { points: number; reason?: string }[] = [];

  const rating = r.rating ?? 0;
  if (rating === 5) parts.push({ points: 3, reason: "a favorite" });
  else if (rating === 4) parts.push({ points: 2, reason: "rated 4 stars" });
  else if (rating === 3) parts.push({ points: 1 });
  else if (rating > 0) parts.push({ points: -2 });

  // Tags you like on your other favorites.
  const self = loved(r) ? 1 : 0;
  let likeness = 0;
  for (const t of r.tags) likeness += 0.5 * Math.min(2, (liked.get(t) ?? 0) - self);
  likeness = Math.min(2, Math.max(0, likeness));
  if (likeness > 0) parts.push({ points: likeness, reason: likeness >= 1 ? "like your favorites" : undefined });

  if (r.tags.includes(`season/${ctx.season}`)) parts.push({ points: 1.5, reason: `good for ${ctx.season}` });
  else if (r.tags.includes(`season/${OPPOSITE[ctx.season]}`)) parts.push({ points: -1 });

  const last = lastCooked(r);
  if (last !== null) {
    const days = (ctx.now - last) / DAY;
    if (days < 3) parts.push({ points: -3 });
    else if (days >= 56) parts.push({ points: 2, reason: `not made in ${weeksText(days)}` });
    else if (days >= 21) parts.push({ points: 1, reason: `not made in ${weeksText(days)}` });
  } else if (ctx.now - r.createdAt < 30 * DAY) {
    parts.push({ points: 0.5, reason: "new to your box" });
  }

  if (ctx.weather === "cozy" && mentions(r, COZY)) parts.push({ points: 1.5, reason: "cozy for tonight" });
  if (ctx.weather === "fresh") {
    if (mentions(r, FRESH)) parts.push({ points: 1.5, reason: "fresh for a hot day" });
    else if (mentions(r, ["soup", "stew"])) parts.push({ points: -1 });
  }

  const score = parts.reduce((s, p) => s + p.points, 0);
  const reasons = parts
    .filter((p): p is { points: number; reason: string } => Boolean(p.reason) && p.points > 0)
    .sort((a, b) => b.points - a.points)
    .map((p) => p.reason);
  return { recipe: r, score, reasons };
}

/** Best first. Ties go to the one changed most recently, then by name. */
export function rankIdeas<T extends Suggestible>(recipes: readonly T[], ctx: IdeasContext): Scored<T>[] {
  const liked = likedTags(recipes);
  return recipes
    .map((r) => scoreRecipe(r, ctx, liked))
    .sort((a, b) => b.score - a.score || b.recipe.updatedAt - a.recipe.updatedAt || a.recipe.title.localeCompare(b.recipe.title));
}

/** One page of ideas. Each Shuffle shows the next few of the best, wrapping around. */
export function pickIdeas<T extends Suggestible>(recipes: readonly T[], ctx: IdeasContext, page = 0): Scored<T>[] {
  const pool = rankIdeas(recipes, ctx).slice(0, POOL);
  if (pool.length <= IDEAS_PER_PAGE) return pool;
  const start = (page * IDEAS_PER_PAGE) % pool.length;
  return Array.from({ length: IDEAS_PER_PAGE }, (_, i) => pool[(start + i) % pool.length]);
}

/** How many Shuffle pages there are before it wraps. */
export function ideaPages(count: number): number {
  return Math.max(1, Math.ceil(Math.min(count, POOL) / IDEAS_PER_PAGE));
}
