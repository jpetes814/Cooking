"use client";

import { arrayUnion, collection, doc, writeBatch } from "firebase/firestore";
import { getFirebase } from "@/lib/firebase/client";
import type { RecipeDoc } from "@/lib/model/recipe";

/**
 * Bringing a backup in. Each recipe becomes a new one in your box, written in
 * batches (no transactions, so it works offline and syncs later). Staples are
 * merged into your pantry list.
 */

const BATCH = 400;

export function importBackup(uid: string, recipes: readonly RecipeDoc[], staples: readonly string[], now: number) {
  const fb = getFirebase();
  if (!fb) throw new Error("Firebase isn't configured");
  const col = collection(fb.db, `users/${uid}/recipes`);
  const report = (err: unknown) => console.error("Recipe Box: importing the backup failed", err);

  for (let i = 0; i < recipes.length; i += BATCH) {
    const batch = writeBatch(fb.db);
    for (const r of recipes.slice(i, i + BATCH)) batch.set(doc(col), { ...r, updatedAt: now });
    batch.commit().catch(report);
  }
  if (staples.length) {
    const batch = writeBatch(fb.db);
    batch.set(doc(fb.db, `users/${uid}/pantry/staples`), { items: arrayUnion(...staples), updatedAt: now }, { merge: true });
    batch.commit().catch(report);
  }
}
