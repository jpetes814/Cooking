"use client";

import { useMemo, useState } from "react";
import Sheet from "@/components/ui/Sheet";
import { inputClass } from "@/components/ui/fields";
import type { Recipe } from "@/lib/model/recipe";
import { missingText, splitHave, whatCanIMake } from "@/lib/suggest/have";

const HAVE_KEY = "recipe-box:have";

function readHave(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(HAVE_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function saveHave(items: string[]) {
  try {
    if (items.length) localStorage.setItem(HAVE_KEY, JSON.stringify(items));
    else localStorage.removeItem(HAVE_KEY);
  } catch {
    // Not remembered this time; no harm.
  }
}

/**
 * Type what's in the fridge and see which of your recipes use it, with what
 * you'd still need. Pantry staples count as things you have. Works offline.
 */
export default function WhatCanIMake({
  recipes,
  staples,
  onOpen,
  onClose,
}: {
  recipes: Recipe[];
  staples: string[];
  onOpen: (id: string) => void;
  onClose: () => void;
}) {
  const [have, setHave] = useState<string[]>(readHave);
  const [draft, setDraft] = useState("");
  const matches = useMemo(() => whatCanIMake(recipes, have, staples), [recipes, have, staples]);

  function update(next: string[]) {
    setHave(next);
    saveHave(next);
  }

  function add(e?: React.FormEvent) {
    e?.preventDefault();
    if (!draft.trim()) return;
    update(splitHave(draft, have));
    setDraft("");
  }

  return (
    <Sheet title="What can I make?" onClose={onClose}>
      <form onSubmit={add} className="flex items-end gap-2">
        <label className="block flex-1">
          <span className="text-sm font-medium">What do you have?</span>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="chicken, lemon, spinach"
            autoCapitalize="none"
            enterKeyHint="done"
            className={inputClass}
          />
        </label>
        <button type="submit" className="min-h-12 shrink-0 rounded-xl bg-accent px-4 font-semibold text-on-accent">
          Add
        </button>
      </form>
      <p className="mt-1 text-xs text-muted">
        {staples.length ? "Your pantry staples count too." : "Add staples on the Pantry tab and they'll count too."}
      </p>

      {have.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <ul aria-label="What you have" className="contents">
            {have.map((h) => (
              <li key={h}>
                <button
                  type="button"
                  aria-label={`Remove ${h}`}
                  onClick={() => update(have.filter((x) => x !== h))}
                  className="flex min-h-10 items-center gap-1 rounded-full bg-accent-soft px-3 text-sm font-medium text-accent"
                >
                  {h} <span aria-hidden>×</span>
                </button>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => update([])} className="min-h-10 px-2 text-sm text-muted">
            Clear
          </button>
        </div>
      )}

      {have.length === 0 ? (
        <p className="mt-6 text-center text-sm text-muted">Add a few things you have to see which recipes use them.</p>
      ) : matches.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted">
          None of your recipes use those yet. Try fewer or more general words, like &ldquo;chicken&rdquo; instead of
          &ldquo;chicken thighs&rdquo;.
        </p>
      ) : (
        <>
          <h3 className="mt-5 text-sm font-semibold text-muted">
            {matches.length} recipe{matches.length === 1 ? "" : "s"} you could make
          </h3>
          <ul aria-label="Recipes you could make" className="mt-2 space-y-2">
            {matches.map(({ recipe: r, uses, missing }) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => onOpen(r.id)}
                  className="flex min-h-14 w-full flex-col rounded-2xl border border-border bg-bg px-4 py-2 text-left"
                >
                  <span className="font-semibold">{r.title}</span>
                  <span className="text-xs text-ok">uses {uses.join(", ")}</span>
                  <span className={`text-xs ${missing.length ? "text-muted" : "font-medium text-ok"}`}>{missingText(missing)}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Sheet>
  );
}
