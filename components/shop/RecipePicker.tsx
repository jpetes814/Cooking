"use client";

import { useMemo, useState } from "react";
import Sheet from "@/components/ui/Sheet";
import { inputClass } from "@/components/ui/fields";
import type { Recipe } from "@/lib/model/recipe";
import { filterRecipes } from "@/lib/search/recipes";

/** Pick which recipes a trip is for. Search to narrow a long list. */
export default function RecipePicker({
  title,
  recipes,
  initial,
  doneLabel,
  onDone,
  onClose,
  children,
}: {
  title: string;
  recipes: Recipe[];
  initial: string[];
  doneLabel: (count: number) => string;
  onDone: (ids: string[]) => void;
  onClose: () => void;
  children?: React.ReactNode;
}) {
  const [picked, setPicked] = useState<string[]>(initial);
  const [query, setQuery] = useState("");
  const shown = useMemo(() => filterRecipes(recipes, { query, tags: [] }), [recipes, query]);
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <Sheet title={title} onClose={onClose}>
      {children}
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Find a recipe"
        aria-label="Find a recipe"
        autoCapitalize="none"
        className={inputClass}
      />
      {recipes.length === 0 ? (
        <p className="mt-4 text-sm text-muted">Add some recipes first, then plan a trip around them.</p>
      ) : (
        <ul aria-label="Recipes to shop for" className="mt-3 divide-y divide-border rounded-2xl border border-border">
          {shown.map((r) => {
            const on = picked.includes(r.id);
            return (
              <li key={r.id}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => toggle(r.id)}
                  className="flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left"
                >
                  <span
                    aria-hidden
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${
                      on ? "border-accent bg-accent text-on-accent" : "border-border"
                    }`}
                  >
                    {on ? "✓" : ""}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{r.title}</span>
                    <span className="text-xs text-muted">
                      {r.ingredients.length
                        ? `${r.ingredients.length} ingredient${r.ingredients.length === 1 ? "" : "s"}`
                        : "No ingredients yet"}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="pb-safe sticky bottom-0 mt-4 bg-surface py-3">
        <button
          type="button"
          onClick={() => onDone(picked)}
          className="min-h-12 w-full rounded-xl bg-accent font-semibold text-on-accent"
        >
          {doneLabel(picked.length)}
        </button>
      </div>
    </Sheet>
  );
}
