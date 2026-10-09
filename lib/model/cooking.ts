import type { RecipeDoc } from "./recipe";

/**
 * What you think of a recipe and when you made it: the "what you like" signal
 * that recommendations build on. Pure so it can be tested.
 */

export const MAX_COOKED_LOG = 200;
const DAY = 24 * 60 * 60 * 1000;

export type Rated = Pick<RecipeDoc, "rating" | "cooked">;

export function lastCooked(r: Rated): number | null {
  const log = r.cooked ?? [];
  return log.length ? Math.max(...log) : null;
}

export function isFavorite(r: Rated): boolean {
  return (r.rating ?? 0) >= 4;
}

/** Tapping the star you already picked clears the rating. */
export function nextRating(current: number | null | undefined, tapped: number): number | null {
  return current === tapped ? null : Math.min(5, Math.max(1, Math.round(tapped)));
}

/** "today", "yesterday", "5 days ago", "3 weeks ago", "2 months ago", "over a year ago". */
export function daysAgo(then: number, now: number): string {
  const startOf = (t: number) => {
    const d = new Date(t);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  };
  const days = Math.round((startOf(now) - startOf(then)) / DAY);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  if (days < 365) return `${Math.round(days / 30)} months ago`;
  return "over a year ago";
}

/** "Cooked 3 times · last made 2 days ago", or "Not cooked yet". */
export function cookedSummary(r: Rated, now: number): string {
  const count = r.cooked?.length ?? 0;
  const last = lastCooked(r);
  if (!count || last === null) return "Not cooked yet";
  return `Cooked ${count === 1 ? "once" : `${count} times`} · last made ${daysAgo(last, now)}`;
}

export type SortMode = "newest" | "rating" | "stale" | "cooked";

export const SORT_LABEL: Record<SortMode, string> = {
  newest: "Newest",
  rating: "Top rated",
  cooked: "Cooked most",
  stale: "Not made lately",
};

/** Sorts a copy. Ties fall back to newest, then name. */
export function sortBy<T extends Rated & Pick<RecipeDoc, "updatedAt" | "title">>(list: readonly T[], mode: SortMode): T[] {
  const newest = (a: T, b: T) => b.updatedAt - a.updatedAt || a.title.localeCompare(b.title);
  const by: Record<SortMode, (a: T, b: T) => number> = {
    newest,
    rating: (a, b) => (b.rating ?? 0) - (a.rating ?? 0) || newest(a, b),
    cooked: (a, b) => (b.cooked?.length ?? 0) - (a.cooked?.length ?? 0) || newest(a, b),
    // Never-cooked first, then the longest ago.
    stale: (a, b) => (lastCooked(a) ?? 0) - (lastCooked(b) ?? 0) || newest(a, b),
  };
  return [...list].sort(by[mode]);
}

export const MAX_NEXT_TIME = 2000;

const pad = (n: number) => String(n).padStart(2, "0");

/** A local date as YYYY-MM-DD, the way a date input wants it. */
export function toDateInput(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** For "I made this before": a week ago is a good guess. */
export function defaultPastDate(now: number): string {
  return toDateInput(now - 7 * DAY);
}

/**
 * A date from the picker as a time to log: noon that day on this phone, so it
 * reads as the same day anywhere nearby. Empty, unreadable, or future dates are refused.
 */
export function pastCookDate(value: string, now: number): { ok: true; at: number } | { ok: false; error: string } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return { ok: false, error: "Pick a date." };
  const [y, mo, d] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
  const date = new Date(y, mo, d, 12);
  if (date.getFullYear() !== y || date.getMonth() !== mo || date.getDate() !== d) return { ok: false, error: "Pick a date." };
  if (toDateInput(date.getTime()) > toDateInput(now)) return { ok: false, error: "That date hasn't happened yet." };
  // Today before noon stays in the past.
  return { ok: true, at: Math.min(date.getTime(), now) };
}

/** Every time it was cooked, newest first. */
export function cookedLog(r: Rated): number[] {
  return [...new Set(r.cooked ?? [])].sort((a, b) => b - a);
}

/** "Sat, Oct 3, 2026" */
export function formatCookDate(t: number): string {
  return new Date(t).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

/** Trimmed and within the limit the rules allow. */
export function tidyNextTime(s: string): string {
  return s.trim().slice(0, MAX_NEXT_TIME);
}
