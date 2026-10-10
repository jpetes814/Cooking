"use client";

import { useEffect, useState } from "react";
import { watchTrips } from "@/lib/data/trips";
import type { Trip } from "@/lib/model/trip";

export type TripsState = { status: "loading" } | { status: "denied" } | { status: "ready"; trips: Trip[] };

/** Live shopping trips, newest first, from the phone's copy first. */
export function useTrips(uid: string): TripsState {
  const [state, setState] = useState<TripsState>({ status: "loading" });
  useEffect(
    () =>
      watchTrips(
        uid,
        (trips) => setState({ status: "ready", trips: [...trips].sort((a, b) => b.createdAt - a.createdAt) }),
        (err) => {
          if (err.code === "permission-denied") setState({ status: "denied" });
        }
      ),
    [uid]
  );
  return state;
}
