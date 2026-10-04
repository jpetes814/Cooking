"use client";

import { arrayRemove, arrayUnion, doc, setDoc, type FirestoreError } from "firebase/firestore";
import { getFirebase } from "@/lib/firebase/client";
import type { PantryDoc } from "@/lib/model/pantry";
import { watchDoc } from "./watch";

/**
 * Pantry staples live in one small document per person. Writes never wait for
 * the server: Firestore applies them on the phone right away and syncs when it
 * can. arrayUnion and arrayRemove merge cleanly if two offline edits meet.
 */

const path = (uid: string) => `users/${uid}/pantry/staples`;

function ref(uid: string) {
  const fb = getFirebase();
  if (!fb) throw new Error("Firebase isn't configured");
  return doc(fb.db, path(uid));
}

function reportFailure(what: string) {
  return (err: unknown) => console.error(`Recipe Box: ${what} failed`, err);
}

export function watchPantry(
  uid: string,
  onData: (items: string[], pending: boolean) => void,
  onError: (err: FirestoreError) => void
): () => void {
  return watchDoc<PantryDoc>(path(uid), "pantry", (data, pending) => onData(data?.items ?? [], pending), onError);
}

export function addStaple(uid: string, item: string) {
  setDoc(ref(uid), { items: arrayUnion(item), updatedAt: Date.now() }, { merge: true }).catch(
    reportFailure("saving a staple")
  );
}

export function removeStaple(uid: string, item: string) {
  setDoc(ref(uid), { items: arrayRemove(item), updatedAt: Date.now() }, { merge: true }).catch(
    reportFailure("removing a staple")
  );
}
