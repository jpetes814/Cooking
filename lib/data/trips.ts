"use client";

import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  FieldPath,
  setDoc,
  updateDoc,
  type FirestoreError,
} from "firebase/firestore";
import { getFirebase } from "@/lib/firebase/client";
import type { Trip, TripDoc } from "@/lib/model/trip";
import { watchCollection } from "./watch";

/**
 * Shopping trips. Writes never wait for the server, so checking things off
 * works in a store with no signal. Each check mark is its own field, so taps
 * from two phones never undo each other.
 */

const path = (uid: string) => `users/${uid}/trips`;

function db() {
  const fb = getFirebase();
  if (!fb) throw new Error("Firebase isn't configured");
  return fb.db;
}

const ref = (uid: string, id: string) => doc(db(), path(uid), id);

function reportFailure(what: string) {
  return (err: unknown) => console.error(`Recipe Box: ${what} failed`, err);
}

export function watchTrips(uid: string, onData: (trips: Trip[]) => void, onError: (err: FirestoreError) => void): () => void {
  return watchCollection<TripDoc>(path(uid), "trips", [], onData, onError);
}

/** Saves a new trip and returns its id right away, online or not. */
export function createTrip(uid: string, trip: TripDoc): string {
  const r = doc(collection(db(), path(uid)));
  setDoc(r, trip).catch(reportFailure("saving the trip"));
  return r.id;
}

/** Changes which recipes the trip is for, forgetting the servings of any that were dropped. */
export function setTripRecipes(uid: string, id: string, recipeIds: string[], dropped: string[] = []) {
  const forget = dropped.flatMap((r) => [new FieldPath("servings", r), deleteField()]);
  updateDoc(ref(uid, id), "recipeIds", recipeIds, "updatedAt", Date.now(), ...forget).catch(
    reportFailure("changing the trip's recipes")
  );
}

/** How much of one recipe to shop for. One field each, so two phones never undo each other. */
export function setTripServings(uid: string, id: string, recipeId: string, target: number) {
  updateDoc(ref(uid, id), new FieldPath("servings", recipeId), target, "updatedAt", Date.now()).catch(
    reportFailure("changing the servings")
  );
}

export function renameTrip(uid: string, id: string, name: string) {
  updateDoc(ref(uid, id), { name, updatedAt: Date.now() }).catch(reportFailure("renaming the trip"));
}

export function setChecked(uid: string, id: string, key: string, on: boolean) {
  updateDoc(ref(uid, id), new FieldPath("checked", key), on ? true : deleteField(), "updatedAt", Date.now()).catch(
    reportFailure("checking that off")
  );
}

export function uncheckAll(uid: string, id: string) {
  updateDoc(ref(uid, id), { checked: {}, updatedAt: Date.now() }).catch(reportFailure("clearing the check marks"));
}

export function addExtra(uid: string, id: string, item: string) {
  updateDoc(ref(uid, id), { extras: arrayUnion(item), updatedAt: Date.now() }).catch(reportFailure("adding that item"));
}

export function removeExtra(uid: string, id: string, item: string) {
  updateDoc(ref(uid, id), { extras: arrayRemove(item), updatedAt: Date.now() }).catch(reportFailure("removing that item"));
}

export function deleteTrip(uid: string, id: string) {
  deleteDoc(ref(uid, id)).catch(reportFailure("deleting the trip"));
}
