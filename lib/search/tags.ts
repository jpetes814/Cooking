/**
 * Tags and sub-tags. A tag is a path: "soup" on its own, or "cuisine/thai"
 * where "cuisine" is the group and "thai" the sub-tag. Filtering by a group
 * ("cuisine") finds every recipe with any tag under it. Pure and unit tested.
 */

export const MAX_TAGS = 50;
export const MAX_TAG_LENGTH = 60;
const MAX_DEPTH = 3;

/** Starter tags, grouped, offered as one-tap adds in the editor. */
export const SUGGESTED_TAGS: { group: string; tags: string[] }[] = [
  { group: "meal", tags: ["breakfast", "lunch", "dinner", "snack", "dessert", "side", "drink"] },
  { group: "dish", tags: ["soup", "salad", "pasta", "bowl", "stew", "curry", "sandwich", "tacos", "casserole", "baking"] },
  { group: "season", tags: ["spring", "summer", "fall", "winter", "holiday"] },
  { group: "diet", tags: ["vegetarian", "vegan", "gluten-free", "dairy-free", "high-protein"] },
  { group: "cuisine", tags: ["italian", "mexican", "thai", "indian", "chinese", "japanese", "korean", "mediterranean", "american"] },
  { group: "effort", tags: ["quick", "weeknight", "one-pot", "make-ahead", "slow-cooker", "freezer-friendly"] },
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
