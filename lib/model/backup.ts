import { z } from "zod";
import { MAX_COOKED_LOG, MAX_NEXT_TIME } from "./cooking";
import { MAX_STAPLES, MAX_STAPLE_LENGTH } from "./pantry";
import { MAX_INGREDIENTS, MAX_LINE, MAX_NOTES, MAX_STEPS, MAX_TITLE, MAX_URL, type RecipeDoc } from "./recipe";
import { MAX_TAG_LENGTH, MAX_TAGS } from "@/lib/search/tags";

/**
 * Backups: your recipes and pantry staples as one file you keep, or bring into
 * the other copy of the app (test to real, or back again). Photos stay behind
 * in this version; everything else comes along. Pure so it can be tested.
 */

export const BACKUP_APP = "recipe-box";
export const BACKUP_VERSION = 1;
export const MAX_BACKUP_RECIPES = 2000;

export interface Backup {
  app: typeof BACKUP_APP;
  version: number;
  exportedAt: number;
  recipes: RecipeDoc[];
  pantry: string[];
}

/** What goes in the file: recipes without photos (their files don't travel), and staples. */
export function makeBackup(recipes: readonly RecipeDoc[], pantry: readonly string[], now: number): Backup {
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: now,
    recipes: recipes.map((r) => {
      // Strip what belongs to this copy of the app or this phone.
      const copy: Partial<RecipeDoc & { id: string; pending: boolean }> = { ...r };
      delete copy.photos;
      delete copy.id;
      delete copy.pending;
      return copy as RecipeDoc;
    }),
    pantry: [...pantry],
  };
}

/** "recipe-box-backup-2026-10-10.json" */
export function backupFileName(now: number): string {
  const d = new Date(now);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `recipe-box-backup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
}

const Ingredient = z.object({
  raw: z.string().max(MAX_LINE),
  qty: z.number().finite().nullable(),
  unit: z.string().max(20).nullable(),
  name: z.string().max(MAX_LINE),
});

// Matches what firestore.rules accepts, so a backup can never write something the rules refuse.
const RecipeSchema = z.object({
  title: z.string().trim().min(1).max(MAX_TITLE),
  source: z.object({ kind: z.enum(["manual", "link"]), url: z.string().max(MAX_URL).nullable() }),
  servings: z.number().positive().finite().nullable(),
  ingredients: z.array(Ingredient).max(MAX_INGREDIENTS),
  steps: z.array(z.string().max(MAX_LINE)).max(MAX_STEPS),
  tags: z.array(z.string().max(MAX_TAG_LENGTH)).max(MAX_TAGS),
  notes: z.string().max(MAX_NOTES),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  cooked: z.array(z.number().finite()).max(MAX_COOKED_LOG).optional(),
  nextTime: z.string().max(MAX_NEXT_TIME).optional(),
  createdAt: z.number().finite(),
  updatedAt: z.number().finite(),
});

const BackupSchema = z.object({
  app: z.literal(BACKUP_APP),
  version: z.number().int().min(1),
  exportedAt: z.number(),
  recipes: z.array(z.unknown()).max(MAX_BACKUP_RECIPES),
  pantry: z.array(z.string()).max(MAX_STAPLES * 2).default([]),
});

export type ReadBackup =
  | { ok: true; recipes: RecipeDoc[]; pantry: string[]; exportedAt: number; unreadable: number }
  | { ok: false; error: string };

/** Reads a backup file's text. Recipes that don't fit are counted and left out, not fatal. */
export function readBackup(text: string): ReadBackup {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: "That file isn't a Recipe Box backup." };
  }
  const parsed = BackupSchema.safeParse(json);
  if (!parsed.success) return { ok: false, error: "That file isn't a Recipe Box backup." };
  if (parsed.data.version > BACKUP_VERSION) {
    return { ok: false, error: "That backup is from a newer version of the app. Update the app, then try again." };
  }
  const recipes: RecipeDoc[] = [];
  let unreadable = 0;
  for (const raw of parsed.data.recipes) {
    const r = RecipeSchema.safeParse(raw);
    if (r.success) recipes.push(r.data as RecipeDoc);
    else unreadable++;
  }
  const pantry = parsed.data.pantry
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s && s.length <= MAX_STAPLE_LENGTH);
  return { ok: true, recipes, pantry: [...new Set(pantry)], exportedAt: parsed.data.exportedAt, unreadable };
}

const sameKey = (r: Pick<RecipeDoc, "title" | "createdAt">) => `${r.title.trim().toLowerCase()}|${r.createdAt}`;

/** Which recipes to add: anything you don't already have (same name, saved at the same moment). */
export function planImport(incoming: readonly RecipeDoc[], existing: readonly Pick<RecipeDoc, "title" | "createdAt">[]) {
  const have = new Set(existing.map(sameKey));
  const toAdd: RecipeDoc[] = [];
  let skipped = 0;
  for (const r of incoming) {
    const key = sameKey(r);
    if (have.has(key)) skipped++;
    else {
      have.add(key);
      toAdd.push(r);
    }
  }
  return { toAdd, skipped };
}

/** Staples from the backup you don't have yet, within the pantry's limit. */
export function newStaples(incoming: readonly string[], current: readonly string[]): string[] {
  const room = Math.max(0, MAX_STAPLES - current.length);
  return incoming.filter((s) => !current.includes(s)).slice(0, room);
}
