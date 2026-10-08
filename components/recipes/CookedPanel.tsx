"use client";

import { useState } from "react";
import { useNow } from "@/components/shell/useNow";
import {
  cookedLog,
  cookedSummary,
  defaultPastDate,
  formatCookDate,
  MAX_COOKED_LOG,
  nextRating,
  pastCookDate,
  toDateInput,
} from "@/lib/model/cooking";
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
  onNextTime,
}: {
  recipe: Recipe;
  onRate: (rating: number | null) => void;
  onCooked: (at: number) => void;
  onUndoCooked: (at: number) => void;
  /** Opens the "Next time" note. */
  onNextTime: () => void;
}) {
  const now = useNow();
  const [justLogged, setJustLogged] = useState<number | null>(null);
  const [past, setPast] = useState<string | null>(null);
  const [pastError, setPastError] = useState<string | null>(null);
  const [showDates, setShowDates] = useState(false);
  const rating = recipe.rating ?? 0;
  const log = cookedLog(recipe);
  const full = log.length >= MAX_COOKED_LOG;

  function addPast() {
    const picked = pastCookDate(past ?? "", Date.now());
    if (!picked.ok) {
      setPastError(picked.error);
      return;
    }
    onCooked(picked.at);
    setPast(null);
    setPastError(null);
  }

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
          disabled={full}
          onClick={() => {
            const at = Date.now();
            onCooked(at);
            setJustLogged(at);
          }}
          className="min-h-11 shrink-0 rounded-xl bg-accent px-4 font-semibold text-on-accent disabled:opacity-60"
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
      {justLogged !== null && (recipe.cooked ?? []).includes(justLogged) && (
        <button type="button" onClick={onNextTime} className="min-h-11 text-sm font-medium text-accent">
          Anything to change next time?
        </button>
      )}
      {rating === 0 && log.length > 0 && (
        <p className="mt-1 text-xs text-muted">How was it? Tap the stars so the app learns what you like.</p>
      )}

      {past === null ? (
        <div className="mt-1 flex flex-wrap gap-x-2">
          {!full && (
            <button
              type="button"
              onClick={() => setPast(defaultPastDate(Date.now()))}
              className="min-h-11 text-sm font-medium text-accent"
            >
              I made this before
            </button>
          )}
          {log.length > 0 && (
            <button
              type="button"
              aria-expanded={showDates}
              onClick={() => setShowDates((s) => !s)}
              className="min-h-11 px-2 text-sm font-medium text-accent"
            >
              {showDates ? "Hide dates" : "Show dates"}
            </button>
          )}
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <label className="block">
            <span className="text-sm font-medium">When did you make it?</span>
            <input
              type="date"
              value={past}
              max={toDateInput(now)}
              onChange={(e) => {
                setPast(e.target.value);
                setPastError(null);
              }}
              className="mt-1 block min-h-12 w-full rounded-xl border border-border bg-bg px-3 text-base outline-none focus:border-accent"
            />
          </label>
          {pastError && (
            <p role="alert" className="text-sm text-warn">
              {pastError}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setPast(null);
                setPastError(null);
              }}
              className="min-h-11 flex-1 rounded-xl border border-border font-medium"
            >
              Cancel
            </button>
            <button type="button" onClick={addPast} className="min-h-11 flex-1 rounded-xl bg-accent font-semibold text-on-accent">
              Add date
            </button>
          </div>
        </div>
      )}
      {full && <p className="mt-1 text-xs text-muted">That&apos;s {MAX_COOKED_LOG} dates, the most it keeps. Remove an old one to add more.</p>}

      {showDates && log.length > 0 && (
        <ul aria-label="Times you made it" className="mt-2 divide-y divide-border rounded-xl border border-border">
          {log.map((at) => (
            <li key={at} className="flex items-center justify-between gap-2 pl-3 text-sm">
              <span>{formatCookDate(at)}</span>
              <button
                type="button"
                aria-label={`Remove ${formatCookDate(at)}`}
                onClick={() => onUndoCooked(at)}
                className="min-h-11 px-3 font-medium text-warn"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
