/**
 * Tags and sub-tags. A tag is a path: "soup" on its own, or "cuisine/thai"
 * where "cuisine" is the group and "thai" the sub-tag. Filtering by a group
 * ("cuisine") finds every recipe with any tag under it. Pure and unit tested.
 */

export const MAX_TAGS = 50;
export const MAX_TAG_LENGTH = 60;
const MAX_DEPTH = 3;

/** How it gets cooked: also offered as a filter in "What can I make?". */
export const METHODS = ["oven", "stovetop", "grill", "air-fryer", "slow-cooker", "instant-pot", "one-pot", "one-pan", "no-cook"] as const;
export type Method = (typeof METHODS)[number];

/** "air-fryer" -> "air fryer". */
export function methodLabel(m: string): string {
  return m.replace(/-/g, " ");
}

/**
 * True when a recipe's tags say it's cooked this way. Matches any group, so a
 * slow-cooker tag saved under "effort" before methods existed still counts.
 */
export function usesMethod(tags: readonly string[], method: string): boolean {
  return tags.some((t) => tagLeaf(t) === method);
}

/** How long it takes, start to finish. */
export const TIMES = ["under-30-min", "30-60-min", "over-an-hour"] as const;
/** How much work it is, plus the plan-ahead kinds. */
export const EFFORTS = ["easy", "medium", "involved", "make-ahead", "freezer-friendly"] as const;

export type TimeLimit = 30 | 60;

/** The time tag for a recipe that takes this many minutes. */
export function timeTag(minutes: number): string {
  if (minutes <= 30) return "time/under-30-min";
  if (minutes <= 60) return "time/30-60-min";
  return "time/over-an-hour";
}

/** Tagged as fitting in this many minutes. "quick" and "weeknight" from before time tags still count. */
export function fitsTime(tags: readonly string[], limit: TimeLimit): boolean {
  const leaves = tags.map(tagLeaf);
  if (leaves.includes("under-30-min") || leaves.includes("quick")) return true;
  return limit === 60 && (leaves.includes("30-60-min") || leaves.includes("weeknight"));
}

export function isEasy(tags: readonly string[]): boolean {
  return tags.some((t) => tagLeaf(t) === "easy");
}

/** Starter tags, grouped, offered as one-tap adds in the editor. */
export const SUGGESTED_TAGS: { group: string; tags: string[] }[] = [
  { group: "meal", tags: ["breakfast", "lunch", "dinner", "snack", "dessert", "side", "drink"] },
  { group: "dish", tags: ["soup", "salad", "pasta", "bowl", "stew", "curry", "sandwich", "tacos", "casserole", "baking"] },
  { group: "season", tags: ["spring", "summer", "fall", "winter", "holiday"] },
  { group: "diet", tags: ["vegetarian", "vegan", "gluten-free", "dairy-free", "high-protein"] },
  { group: "cuisine", tags: ["italian", "mexican", "thai", "indian", "chinese", "japanese", "korean", "mediterranean", "american"] },
  { group: "method", tags: [...METHODS] },
  { group: "time", tags: [...TIMES] },
  { group: "effort", tags: [...EFFORTS] },
];

/** "  Cuisine / Middle  Eastern " -> "cuisine/middle eastern". Null if empty or too long. */
export function normalizeTag(raw: string): string | null {
  const parts = raw
    .toLowerCase()
    .split("/")
    .map((p) => p.trim().replace(/\s+/g, " ").replace(/^#/, ""))
    .filter(Boolean)
    .slice(0, MAX_DEPTH);
  const tag = parts.join("/");
  if (!tag || tag.length > MAX_TAG_LENGTH) return null;
  return tag;
}

/** Tidies a list: normalized, no repeats, sorted, capped. */
export function normalizeTags(raw: readonly string[]): string[] {
  const set = new Set<string>();
  for (const r of raw) {
    const t = normalizeTag(r);
    if (t) set.add(t);
  }
  return [...set].sort().slice(0, MAX_TAGS);
}

/** "cuisine/thai" -> "thai"; "soup" -> "soup". */
export function tagLeaf(tag: string): string {
  return tag.slice(tag.lastIndexOf("/") + 1);
}

/** "cuisine/thai" -> "cuisine"; "soup" -> null. */
export function tagGroup(tag: string): string | null {
  const i = tag.indexOf("/");
  return i === -1 ? null : tag.slice(0, i);
}

/** A filter matches the tag itself and anything under it: "cuisine" matches "cuisine/thai". */
export function tagMatches(filter: string, tag: string): boolean {
  return tag === filter || tag.startsWith(`${filter}/`);
}

/** Every tag in use, plus its groups, with how many recipes have each. Most used first. */
export function tagCounts(recipes: readonly { tags: readonly string[] }[]): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const r of recipes) {
    const seen = new Set<string>();
    for (const t of r.tags) {
      const parts = t.split("/");
      for (let i = 1; i <= parts.length; i++) seen.add(parts.slice(0, i).join("/"));
    }
    for (const t of seen) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

/** The season right now, by month (northern hemisphere). */
export function currentSeason(date: Date): "spring" | "summer" | "fall" | "winter" {
  const m = date.getMonth();
  if (m >= 2 && m <= 4) return "spring";
  if (m >= 5 && m <= 7) return "summer";
  if (m >= 8 && m <= 10) return "fall";
  return "winter";
}
