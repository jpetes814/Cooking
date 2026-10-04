"use client";

import { collection, deleteDoc, doc, setDoc, type FirestoreError } from "firebase/firestore";
import { getFirebase } from "@/lib/firebase/client";
import type { Recipe, RecipeDoc } from "@/lib/model/recipe";
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

export function updateRecipe(uid: string, id: string, recipe: RecipeDoc) {
  setDoc(doc(db(), path(uid), id), recipe).catch(reportFailure("saving your changes"));
}

export function deleteRecipe(uid: string, id: string) {
  deleteDoc(doc(db(), path(uid), id)).catch(reportFailure("deleting the recipe"));
}
