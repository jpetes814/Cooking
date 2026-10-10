import { describe, expect, it } from "vitest";
import { ideaPages, likedTags, pickIdeas, rankIdeas, scoreRecipe, type Suggestible } from "@/lib/suggest/ideas";

const NOW = new Date(2026, 9, 9, 18, 0).getTime();
const DAY = 86_400_000;
const OLD = NOW - 400 * DAY;

const recipe = (title: string, extra: Partial<Suggestible> = {}): Suggestible => ({
  title,
  tags: [],
  rating: null,
  cooked: [],
  createdAt: OLD,
  updatedAt: OLD,
  ...extra,
});

const ctx = { now: NOW, season: "fall" as const };
const titles = (list: { recipe: Suggestible }[]) => list.map((s) => s.recipe.title);

describe("ideas for tonight", () => {
  it("puts favorites first and says why", () => {
    const ranked = rankIdeas([recipe("Plain rice"), recipe("Best lasagna", { rating: 5 }), recipe("Ok tacos", { rating: 3 })], ctx);
    expect(titles(ranked)).toEqual(["Best lasagna", "Ok tacos", "Plain rice"]);
    expect(ranked[0].reasons).toContain("a favorite");
  });

  it("sinks something you just made, and low ratings", () => {
    const ranked = rankIdeas(
      [recipe("Yesterday's curry", { rating: 5, cooked: [NOW - DAY] }), recipe("Meh soup", { rating: 2 }), recipe("Toast")],
      ctx
    );
    expect(titles(ranked)).toEqual(["Toast", "Yesterday's curry", "Meh soup"]);
  });

  it("brings back ones you haven't made in a while", () => {
    const s = scoreRecipe(recipe("Old friend", { cooked: [NOW - 70 * DAY] }), ctx, new Map());
    expect(s.score).toBe(2);
    expect(s.reasons).toEqual(["not made in 2 months"]);
    expect(scoreRecipe(recipe("Recent", { cooked: [NOW - 25 * DAY] }), ctx, new Map()).reasons).toEqual(["not made in 4 weeks"]);
  });

  it("likes what's in season and skips the opposite", () => {
    const ranked = rankIdeas(
      [recipe("Watermelon salad", { tags: ["season/summer"] }), recipe("Apple crisp", { tags: ["season/fall"] }), recipe("Plain")],
      ctx
    );
    expect(titles(ranked)).toEqual(["Apple crisp", "Plain", "Watermelon salad"]);
    expect(ranked[0].reasons).toEqual(["good for fall"]);
    // Spring is opposite fall.
    expect(scoreRecipe(recipe("Pea soup", { tags: ["season/spring"] }), ctx, new Map()).score).toBe(-1);
  });

  it("looks for tags shared with your other favorites", () => {
    const list = [
      recipe("Pad thai", { tags: ["cuisine/thai"], rating: 5 }),
      recipe("Green curry", { tags: ["cuisine/thai"], cooked: [NOW - 10 * DAY, NOW - 40 * DAY] }),
      recipe("Larb", { tags: ["cuisine/thai", "season/fall"] }),
      recipe("Burger", { tags: ["season/fall"] }),
    ];
    expect(likedTags(list).get("cuisine/thai")).toBe(2);
    const larb = scoreRecipe(list[2], ctx, likedTags(list));
    expect(larb.reasons).toEqual(["good for fall", "like your favorites"]);
    expect(larb.score).toBe(2.5);
  });

  it("calls a recipe new when you just added it", () => {
    expect(scoreRecipe(recipe("Fresh find", { createdAt: NOW - 2 * DAY }), ctx, new Map()).reasons).toEqual(["new to your box"]);
  });

  it("leans cozy on a cold night and fresh on a hot day", () => {
    const list = [recipe("Grilled corn salad"), recipe("Beef stew"), recipe("Tofu stir fry", { tags: ["dish/soup"] })];
    expect(titles(rankIdeas(list, { ...ctx, weather: "cozy" })).slice(0, 2).sort()).toEqual(["Beef stew", "Tofu stir fry"]);
    const fresh = rankIdeas(list, { ...ctx, weather: "fresh" });
    expect(fresh[0].recipe.title).toBe("Grilled corn salad");
    expect(fresh[0].reasons).toEqual(["fresh for a hot day"]);
    expect(fresh[2].score).toBe(-1);
    // "stewed" isn't "stew", and "souper" isn't "soup".
    expect(scoreRecipe(recipe("Souper sandwich"), { ...ctx, weather: "cozy" }, new Map()).score).toBe(0);
  });

  it("shuffles through the best few, wrapping around", () => {
    const list = Array.from({ length: 5 }, (_, i) => recipe(`R${i}`, { rating: 5 - i }));
    expect(titles(pickIdeas(list, ctx, 0))).toEqual(["R0", "R1", "R2"]);
    expect(titles(pickIdeas(list, ctx, 1))).toEqual(["R3", "R4", "R0"]);
    expect(ideaPages(5)).toBe(2);
    expect(ideaPages(40)).toBe(4);
    expect(titles(pickIdeas(list.slice(0, 2), ctx, 3))).toEqual(["R0", "R1"]);
  });

  it("counts grill and no-cook method tags as fresh on a hot day", () => {
    const hot = { ...ctx, weather: "fresh" as const };
    expect(scoreRecipe(recipe("Skewers", { tags: ["method/grill"] }), hot, new Map()).reasons).toEqual(["fresh for a hot day"]);
    expect(scoreRecipe(recipe("Gazpacho bowls", { tags: ["method/no-cook"] }), hot, new Map()).score).toBe(1.5);
  });
});
