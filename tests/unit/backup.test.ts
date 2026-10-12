import { describe, expect, it } from "vitest";
import { backupFileName, makeBackup, newStaples, planImport, readBackup } from "@/lib/model/backup";
import { buildRecipe, type RecipeDoc } from "@/lib/model/recipe";

const NOW = new Date(2026, 9, 10, 12).getTime();

function recipe(title: string, createdAt: number, extra: Partial<RecipeDoc> = {}): RecipeDoc {
  const built = buildRecipe({ title, url: "", servings: "4", ingredients: "2 cups stock\n1 onion", steps: "Simmer", notes: "" }, createdAt);
  if (!built.ok) throw new Error(built.error);
  return { ...built.recipe, ...extra };
}

describe("backups", () => {
  it("leaves photos and app-only details out of the file", () => {
    const r = { ...recipe("Soup", 1), photos: { p1: { path: "x", url: null, addedAt: 1 } }, id: "abc", pending: true, rating: 5 };
    const b = makeBackup([r], ["salt"], NOW);
    expect(b).toMatchObject({ app: "recipe-box", version: 1, exportedAt: NOW, pantry: ["salt"] });
    expect(b.recipes[0]).not.toHaveProperty("photos");
    expect(b.recipes[0]).not.toHaveProperty("id");
    expect(b.recipes[0]).not.toHaveProperty("pending");
    expect(b.recipes[0].rating).toBe(5);
    expect(backupFileName(NOW)).toBe("recipe-box-backup-2026-10-10.json");
  });

  it("reads back what it wrote", () => {
    const text = JSON.stringify(makeBackup([recipe("Soup", 1, { nextTime: "less salt", cooked: [5] })], ["Salt ", "cumin"], NOW));
    const read = readBackup(text);
    if (!read.ok) throw new Error(read.error);
    expect(read.recipes[0]).toMatchObject({ title: "Soup", nextTime: "less salt", cooked: [5] });
    expect(read.pantry).toEqual(["salt", "cumin"]);
    expect(read.unreadable).toBe(0);
  });

  it("turns away files that aren't backups, or are too new", () => {
    expect(readBackup("not json").ok).toBe(false);
    expect(readBackup(JSON.stringify({ hello: 1 })).ok).toBe(false);
    expect(readBackup(JSON.stringify({ app: "recipe-box", version: 9, exportedAt: 1, recipes: [] }))).toEqual({
      ok: false,
      error: "That backup is from a newer version of the app. Update the app, then try again.",
    });
  });

  it("skips recipes that don't fit, and counts them", () => {
    const good = recipe("Soup", 1);
    const read = readBackup(
      JSON.stringify({ app: "recipe-box", version: 1, exportedAt: 1, recipes: [good, { title: "" }, { ...good, rating: 9 }] })
    );
    expect(read.ok && read.recipes.length).toBe(1);
    expect(read.ok && read.unreadable).toBe(2);
  });

  it("only adds recipes you don't already have", () => {
    const soup = recipe("Soup", 1);
    const stew = recipe("Stew", 2);
    expect(planImport([soup, stew, stew], [{ title: "soup ", createdAt: 1 }])).toEqual({ toAdd: [stew], skipped: 2 });
    // Same name, saved at a different time, is a different recipe.
    expect(planImport([recipe("Soup", 9)], [soup]).toAdd).toHaveLength(1);
  });

  it("adds only new staples, within the limit", () => {
    expect(newStaples(["salt", "cumin"], ["salt"])).toEqual(["cumin"]);
    expect(newStaples(["a", "b"], Array.from({ length: 300 }, (_, i) => `s${i}`))).toEqual([]);
  });
});
