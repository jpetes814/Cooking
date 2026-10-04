"use client";

import { arrayRemove, arrayUnion, collection, deleteDoc, doc, setDoc, updateDoc, type FirestoreError } from "firebase/firestore";
import { getFirebase } from "@/lib/firebase/client";
import { editableFields, type Recipe, type RecipeDoc } from "@/lib/model/recipe";
import { watchCollection } from "./watch";

/**
 * Every read and write of recipes. Writes never wait for the server: Firestore
 * applies them on the phone right away and syncs when it can, so saving works
 * in a kitchen with no signal.
 */

const path = (uid: string) => `users/${uid}/recipes`;

function db() {
  const fb = getFirebase();
  if (!fb) throw new Error("Firebase isn't configured");
  return fb.db;
}

function reportFailure(what: string) {
  return (err: unknown) => console.error(`Recipe Box: ${what} failed`, err);
}

/** Live list of your recipes, from the phone's copy first. */
export function watchRecipes(
  uid: string,
  onData: (recipes: Recipe[]) => void,
  onError: (err: FirestoreError) => void
): () => void {
  return watchCollection<RecipeDoc>(path(uid), "recipes", [], onData, onError);
}

/** Saves a new recipe and returns its id right away, online or not. */
export function createRecipe(uid: string, recipe: RecipeDoc): string {
  const ref = doc(collection(db(), path(uid)));
  setDoc(ref, recipe).catch(reportFailure("saving the recipe"));
  return ref.id;
}

/** Saves an edit. Only the editor's fields, so ratings and the cooked log are left alone. */
export function updateRecipe(uid: string, id: string, recipe: RecipeDoc) {
  updateDoc(doc(db(), path(uid), id), editableFields(recipe)).catch(reportFailure("saving your changes"));
}

/** 1 to 5 stars, or null to clear. */
export function rateRecipe(uid: string, id: string, rating: number | null) {
  updateDoc(doc(db(), path(uid), id), { rating }).catch(reportFailure("saving the rating"));
}

/** Logs a time it was cooked. arrayUnion merges cleanly with taps from another phone. */
export function logCooked(uid: string, id: string, at: number) {
  updateDoc(doc(db(), path(uid), id), { cooked: arrayUnion(at) }).catch(reportFailure("logging that you cooked it"));
}

export function unlogCooked(uid: string, id: string, at: number) {
  updateDoc(doc(db(), path(uid), id), { cooked: arrayRemove(at) }).catch(reportFailure("undoing that"));
}

export function deleteRecipe(uid: string, id: string) {
  deleteDoc(doc(db(), path(uid), id)).catch(reportFailure("deleting the recipe"));
}
