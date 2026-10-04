"use client";

import { useEffect, useState } from "react";
import { watchPantry } from "@/lib/data/pantry";

export type PantryState =
  | { status: "loading" }
  | { status: "denied" }
  | { status: "ready"; items: string[]; pending: boolean };

/** Live pantry staples for the signed-in person, from the phone's copy first. */
export function usePantry(uid: string): PantryState {
  const [state, setState] = useState<PantryState>({ status: "loading" });

  useEffect(
    () =>
      watchPantry(
        uid,
        (items, pending) => setState({ status: "ready", items, pending }),
        (err) => {
          // The rules say no: signed in, but not on the allowlist.
          if (err.code === "permission-denied") setState({ status: "denied" });
        }
      ),
    [uid]
  );

  return state;
}
