"use client";

import { useEffect, useState } from "react";
import { watchRecipes } from "@/lib/data/recipes";
import { sortRecipes, type Recipe } from "@/lib/model/recipe";

export type RecipesState =
  | { status: "loading" }
  | { status: "denied" }
  | { status: "ready"; recipes: Recipe[] };

/** Your recipes, newest first, live. */
export function useRecipes(uid: string): RecipesState {
  const [state, setState] = useState<RecipesState>({ status: "loading" });

  useEffect(
    () =>
      watchRecipes(
        uid,
        (recipes) => setState({ status: "ready", recipes: sortRecipes(recipes) }),
        (err) => {
          if (err.code === "permission-denied") setState({ status: "denied" });
        }
      ),
    [uid]
  );

  return state;
}
