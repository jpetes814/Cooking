"use client";

import { useState } from "react";
import { useNow } from "@/components/shell/useNow";
import { cookedSummary, nextRating } from "@/lib/model/cooking";
import type { Recipe } from "@/lib/model/recipe";

/**
 * Stars and "Cooked it": how the app learns what you like. Both work offline
 * and sync later, and an accidental "Cooked it" can be undone.
 */
export default function CookedPanel({
  recipe,
  onRate,
  onCooked,
  onUndoCooked,
}: {
  recipe: Recipe;
  onRate: (rating: number | null) => void;
  onCooked: (at: number) => void;
  onUndoCooked: (at: number) => void;
}) {
  const now = useNow();
  const [justLogged, setJustLogged] = useState<number | null>(null);
  const rating = recipe.rating ?? 0;

  return (
    <section aria-label="Your notes on this recipe" className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <div role="group" aria-label="Rating" className="flex">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-label={`${n} star${n === 1 ? "" : "s"}`}
              aria-pressed={rating >= n}
              onClick={() => onRate(nextRating(recipe.rating, n))}
              className={`flex h-11 w-10 items-center justify-center text-2xl ${rating >= n ? "text-warn" : "text-border"}`}
            >
              ★
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            const at = Date.now();
            onCooked(at);
            setJustLogged(at);
          }}
          className="min-h-11 shrink-0 rounded-xl bg-accent px-4 font-semibold text-on-accent"
        >
          Cooked it
        </button>
      </div>
      <p className="mt-2 flex items-center justify-between text-sm text-muted">
        <span data-testid="cooked-summary">{cookedSummary(recipe, now)}</span>
        {justLogged !== null && (recipe.cooked ?? []).includes(justLogged) && (
          <button
            type="button"
            onClick={() => {
              onUndoCooked(justLogged);
              setJustLogged(null);
            }}
            className="min-h-10 px-2 font-medium text-accent"
          >
            Undo
          </button>
        )}
      </p>
      {rating === 0 && (recipe.cooked?.length ?? 0) > 0 && (
        <p className="mt-1 text-xs text-muted">How was it? Tap the stars so the app learns what you like.</p>
      )}
    </section>
  );
}
