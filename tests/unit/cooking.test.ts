import { describe, expect, it } from "vitest";
import {
  cookedLog,
  cookedSummary,
  daysAgo,
  defaultPastDate,
  isFavorite,
  lastCooked,
  MAX_NEXT_TIME,
  nextRating,
  pastCookDate,
  sortBy,
  tidyNextTime,
  toDateInput,
} from "@/lib/model/cooking";
import { buildRecipe, editableFields } from "@/lib/model/recipe";

const NOW = new Date(2026, 9, 4, 18, 0).getTime();
const DAY = 86_400_000;

describe("ratings", () => {
  it("sets, changes, and clears with a second tap", () => {
    expect(nextRating(null, 4)).toBe(4);
    expect(nextRating(4, 2)).toBe(2);
    expect(nextRating(4, 4)).toBeNull();
    expect(nextRating(undefined, 9)).toBe(5);
  });

  it("calls 4 and 5 stars favorites", () => {
    expect(isFavorite({ rating: 4 })).toBe(true);
    expect(isFavorite({ rating: 3 })).toBe(false);
    expect(isFavorite({})).toBe(false);
  });
});

describe("cooked log", () => {
  it("talks in days, weeks, and months", () => {
    expect(daysAgo(NOW - 2 * 3600_000, NOW)).toBe("today");
    expect(daysAgo(NOW - DAY, NOW)).toBe("yesterday");
    expect(daysAgo(NOW - 5 * DAY, NOW)).toBe("5 days ago");
    expect(daysAgo(NOW - 21 * DAY, NOW)).toBe("3 weeks ago");
    expect(daysAgo(NOW - 90 * DAY, NOW)).toBe("3 months ago");
    expect(daysAgo(NOW - 400 * DAY, NOW)).toBe("over a year ago");
  });

  it("summarizes", () => {
    expect(cookedSummary({}, NOW)).toBe("Not cooked yet");
    expect(cookedSummary({ cooked: [NOW - DAY] }, NOW)).toBe("Cooked once · last made yesterday");
    expect(cookedSummary({ cooked: [NOW - 30 * DAY, NOW - 2 * DAY, NOW - 9 * DAY] }, NOW)).toBe(
      "Cooked 3 times · last made 2 days ago"
    );
    expect(lastCooked({ cooked: [3, 9, 1] })).toBe(9);
  });
});

describe("sortBy", () => {
  const r = (title: string, extra: object) => ({ title, updatedAt: 1, ...extra });
  const list = [
    r("A", { rating: 3, cooked: [NOW - 2 * DAY] }),
    r("B", { rating: 5, cooked: [NOW - 40 * DAY, NOW - 10 * DAY, NOW - 3 * DAY] }),
    r("C", {}),
  ];

  it("sorts by rating, times cooked, and not made lately", () => {
    expect(sortBy(list, "rating").map((x) => x.title)).toEqual(["B", "A", "C"]);
    expect(sortBy(list, "cooked").map((x) => x.title)).toEqual(["B", "A", "C"]);
    expect(sortBy(list, "stale").map((x) => x.title)).toEqual(["C", "B", "A"]);
  });
});

describe("editableFields", () => {
  it("leaves out ratings, the cooked log, and creation time", () => {
    const built = buildRecipe({ title: "Soup", url: "", servings: "", ingredients: "", steps: "", notes: "" }, NOW);
    if (!built.ok) throw new Error("expected ok");
    const fields = editableFields({ ...built.recipe, rating: 5, cooked: [1] });
    expect(fields).not.toHaveProperty("rating");
    expect(fields).not.toHaveProperty("cooked");
    expect(fields).not.toHaveProperty("createdAt");
    expect(fields.title).toBe("Soup");
  });
});

describe("I made this before", () => {
  it("suggests a week ago", () => {
    expect(defaultPastDate(NOW)).toBe("2026-09-27");
    expect(toDateInput(NOW)).toBe("2026-10-04");
  });

  it("logs noon on the picked day, and today never lands in the future", () => {
    expect(pastCookDate("2026-09-27", NOW)).toEqual({ ok: true, at: new Date(2026, 8, 27, 12).getTime() });
    const morning = new Date(2026, 9, 4, 8, 0).getTime();
    expect(pastCookDate("2026-10-04", morning)).toEqual({ ok: true, at: morning });
  });

  it("refuses empty, made-up, and future dates", () => {
    expect(pastCookDate("", NOW).ok).toBe(false);
    expect(pastCookDate("2026-02-30", NOW).ok).toBe(false);
    expect(pastCookDate("2026-10-05", NOW)).toEqual({ ok: false, error: "That date hasn't happened yet." });
  });

  it("lists the log newest first without repeats", () => {
    expect(cookedLog({ cooked: [3, 9, 1, 9] })).toEqual([9, 3, 1]);
    expect(cookedLog({})).toEqual([]);
  });
});

describe("notes for next time", () => {
  it("trims and keeps within the limit", () => {
    expect(tidyNextTime("  less salt \n")).toBe("less salt");
    expect(tidyNextTime("x".repeat(2500))).toHaveLength(MAX_NEXT_TIME);
  });

  it("are never part of an edit", () => {
    const built = buildRecipe({ title: "Soup", url: "", servings: "", ingredients: "", steps: "", notes: "" }, NOW);
    if (!built.ok) throw new Error(built.error);
    expect(editableFields({ ...built.recipe, nextTime: "more lime" })).not.toHaveProperty("nextTime");
  });
});
