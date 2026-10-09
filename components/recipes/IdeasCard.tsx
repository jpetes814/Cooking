"use client";

import { useMemo, useState } from "react";
import { coverPhoto } from "@/lib/model/photos";
import type { Recipe } from "@/lib/model/recipe";
import { currentSeason } from "@/lib/search/tags";
import { ideaPages, pickIdeas } from "@/lib/suggest/ideas";
import RecipePhoto from "./RecipePhoto";
import { useWeather } from "./useWeather";

const COLLAPSED_KEY = "recipe-box:ideas-collapsed";

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function saveCollapsed(on: boolean) {
  try {
    if (on) localStorage.setItem(COLLAPSED_KEY, "1");
    else localStorage.removeItem(COLLAPSED_KEY);
  } catch {
    // Not remembered this time; no harm.
  }
}

/**
 * "Ideas for tonight": three recipes from your own box, worked out on the
 * phone so it works with no signal.
 */
export default function IdeasCard({
  uid,
  recipes,
  now,
  onOpen,
}: {
  uid: string;
  recipes: Recipe[];
  now: number;
  onOpen: (id: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [page, setPage] = useState(0);
  const weather = useWeather(now);
  const season = currentSeason(new Date(now));
  const ideas = useMemo(
    () => pickIdeas(recipes, { now, season, weather: weather.mood }, page),
    [recipes, now, season, weather.mood, page]
  );
  const pages = ideaPages(recipes.length);

  function toggle() {
    setCollapsed((c) => {
      saveCollapsed(!c);
      return !c;
    });
  }

  return (
    <section aria-label="Ideas for tonight" className="rounded-2xl border border-border bg-surface p-3">
      <div className="flex items-center justify-between gap-2 pl-1">
        <h2 className="font-semibold">Ideas for tonight</h2>
        <div className="flex">
          {!collapsed && pages > 1 && (
            <button type="button" onClick={() => setPage((p) => (p + 1) % pages)} className="min-h-11 px-3 text-sm font-medium text-accent">
              Shuffle
            </button>
          )}
          <button
            type="button"
            aria-expanded={!collapsed}
            onClick={toggle}
            className="min-h-11 px-2 text-sm font-medium text-muted"
          >
            {collapsed ? "Show" : "Hide"}
          </button>
        </div>
      </div>

      {!collapsed && (
        <>
          <ul className="mt-1 space-y-1">
            {ideas.map(({ recipe: r, reasons }) => {
              const cover = coverPhoto(r.photos);
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(r.id)}
                    className="flex min-h-14 w-full items-center gap-3 rounded-xl px-1 py-1 text-left active:bg-surface-2"
                  >
                    {cover ? (
                      <RecipePhoto uid={uid} recipeId={r.id} photo={cover} alt="" className="h-12 w-12 shrink-0 rounded-lg" />
                    ) : (
                      <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-xl">
                        🍲
                      </span>
                    )}
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate font-medium">{r.title}</span>
                      {reasons.length > 0 && <span className="truncate text-xs text-muted">{reasons.slice(0, 2).join(" · ")}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-x-2 pl-1">
            <p data-testid="ideas-why" className="text-xs text-muted">
              {weather.line}
            </p>
            <button
              type="button"
              onClick={weather.on ? weather.turnOff : weather.turnOn}
              disabled={weather.busy}
              className="min-h-11 text-xs font-medium text-accent disabled:opacity-60"
            >
              {weather.on ? "Turn off weather" : "Use local weather"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
