"use client";

import { useMemo, useState } from "react";
import { useOnline } from "@/components/shell/useOnline";
import { callAi } from "@/lib/ai/client";
import type { FoundIdea } from "@/lib/import/find";
import Sheet from "@/components/ui/Sheet";
import { inputClass } from "@/components/ui/fields";
import type { Recipe } from "@/lib/model/recipe";
import { filtersOn, missingText, NO_FILTERS, splitHave, whatCanIMake, type HaveFilters } from "@/lib/suggest/have";
import { METHODS, methodLabel, type Method, type TimeLimit } from "@/lib/search/tags";

const HAVE_KEY = "recipe-box:have";
const FILTERS_KEY = "recipe-box:have-filters";

function readFilters(): HaveFilters {
  try {
    const v = JSON.parse(localStorage.getItem(FILTERS_KEY) ?? "null") as Partial<HaveFilters> | null;
    return {
      method: v && (METHODS as readonly string[]).includes(v.method ?? "") ? (v.method as Method) : null,
      time: v?.time === 30 || v?.time === 60 ? v.time : null,
      easy: v?.easy === true,
    };
  } catch {
    return NO_FILTERS;
  }
}

function saveFilters(f: HaveFilters) {
  try {
    if (filtersOn(f)) localStorage.setItem(FILTERS_KEY, JSON.stringify(f));
    else localStorage.removeItem(FILTERS_KEY);
  } catch {
    // Not remembered this time; no harm.
  }
}

const TIME_LABEL: Record<TimeLimit, string> = { 30: "Under 30 min", 60: "Under an hour" };

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`min-h-10 shrink-0 rounded-full border px-3 text-sm ${
        on ? "border-accent bg-accent-soft font-semibold text-accent" : "border-border bg-surface"
      }`}
    >
      {children}
    </button>
  );
}

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
  onSaveLink,
  onClose,
}: {
  recipes: Recipe[];
  staples: string[];
  onOpen: (id: string) => void;
  /** Start a new recipe from a page found on the web. */
  onSaveLink: (start: { title: string; url: string }) => void;
  onClose: () => void;
}) {
  const online = useOnline();
  const [web, setWeb] = useState<
    { status: "idle" } | { status: "busy" } | { status: "done"; for: string; ideas: FoundIdea[] } | { status: "error"; text: string }
  >({ status: "idle" });
  const [have, setHave] = useState<string[]>(readHave);
  const [draft, setDraft] = useState("");
  const [filters, setFilters] = useState<HaveFilters>(readFilters);
  const [showFilters, setShowFilters] = useState(() => filtersOn(filters));
  const matches = useMemo(() => whatCanIMake(recipes, have, staples, filters), [recipes, have, staples, filters]);

  function filter(next: Partial<HaveFilters>) {
    setFilters((f) => {
      const merged = { ...f, ...next };
      saveFilters(merged);
      return merged;
    });
  }

  function update(next: string[]) {
    setHave(next);
    saveHave(next);
  }

  async function findOnWeb() {
    setWeb({ status: "busy" });
    const res = await callAi<{ ideas: FoundIdea[] }>("/api/find-recipes", {
      have,
      saved: recipes.map((r) => r.title),
      method: filters.method,
      maxMinutes: filters.time,
      easy: filters.easy,
    });
    const asked = [have.join(", "), filters.method && methodLabel(filters.method), filters.time && TIME_LABEL[filters.time].toLowerCase(), filters.easy && "easy"]
      .filter(Boolean)
      .join(" · ");
    setWeb(res.ok ? { status: "done", for: asked, ideas: res.data.ideas } : { status: "error", text: res.error });
  }

  function add(e?: React.FormEvent) {
    e?.preventDefault();
    if (!draft.trim()) return;
    update(splitHave(draft, have));
    setDraft("");
  }

  const currentAsk = [have.join(", "), filters.method && methodLabel(filters.method), filters.time && TIME_LABEL[filters.time].toLowerCase(), filters.easy && "easy"]
    .filter(Boolean)
    .join(" · ");

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

      <div className="mt-4 rounded-2xl border border-border px-3">
        <button
          type="button"
          aria-expanded={showFilters}
          onClick={() => setShowFilters((v) => !v)}
          className="flex min-h-11 w-full items-center justify-between text-left text-sm font-medium"
        >
          <span>
            Cooking method, time, and effort{filtersOn(filters) && <span className="text-accent">{" · on"}</span>}
          </span>
          <span aria-hidden className="text-muted">{showFilters ? "▴" : "▾"}</span>
        </button>
        {showFilters && (
          <div className="space-y-3 pb-3">
            <div role="group" aria-label="How do you want to cook it?">
              <p className="mb-1 text-xs text-muted">How do you want to cook it?</p>
              <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1">
                <Chip on={filters.method === null} onClick={() => filter({ method: null })}>
                  Any way
                </Chip>
                {METHODS.map((m) => (
                  <Chip key={m} on={filters.method === m} onClick={() => filter({ method: filters.method === m ? null : m })}>
                    {methodLabel(m)}
                  </Chip>
                ))}
              </div>
            </div>
            <div role="group" aria-label="How long do you have?">
              <p className="mb-1 text-xs text-muted">How long do you have?</p>
              <div className="flex flex-wrap gap-2">
                <Chip on={filters.time === null} onClick={() => filter({ time: null })}>
                  Any time
                </Chip>
                {([30, 60] as const).map((t) => (
                  <Chip key={t} on={filters.time === t} onClick={() => filter({ time: filters.time === t ? null : t })}>
                    {TIME_LABEL[t]}
                  </Chip>
                ))}
                <Chip on={filters.easy} onClick={() => filter({ easy: !filters.easy })}>
                  Easy only
                </Chip>
              </div>
            </div>
          </div>
        )}
      </div>

      {have.length === 0 ? (
        <p className="mt-6 text-center text-sm text-muted">Add a few things you have to see which recipes use them.</p>
      ) : matches.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted">
          {filtersOn(filters) ? (
            <>
              None of your recipes match with these filters. Filters only find recipes with method, time, or effort tags, so
              add those with Edit, or try the web below.
            </>
          ) : (
            <>
              None of your recipes use those yet. Try fewer or more general words, like &ldquo;chicken&rdquo; instead of
              &ldquo;chicken thighs&rdquo;.
            </>
          )}
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

      {have.length > 0 && (
        <section aria-label="New recipes from the web" className="mt-6 border-t border-border pt-4">
          <h3 className="font-semibold">Try something new</h3>
          <p className="mt-1 text-xs text-muted">Claude searches the web for recipes that use what you have. You check each one before it&apos;s saved.</p>
          <button
            type="button"
            onClick={findOnWeb}
            disabled={!online || web.status === "busy"}
            className="mt-3 min-h-11 w-full rounded-xl border border-accent bg-accent-soft font-semibold text-accent disabled:opacity-60"
          >
            {!online
              ? "Finding new recipes needs signal"
              : web.status === "busy"
                ? "Searching the web..."
                : web.status === "done"
                  ? "Search again"
                  : "Find new ones on the web"}
          </button>
          {web.status === "error" && (
            <p role="status" className="mt-2 text-sm text-warn">
              {web.text}
            </p>
          )}
          {web.status === "done" && (
            <>
              {web.for !== currentAsk && (
                <p className="mt-2 text-xs text-muted">Found for: {web.for}. Search again for your new list.</p>
              )}
              <ul aria-label="Found on the web" className="mt-3 space-y-2">
                {web.ideas.map((idea) => (
                  <li key={idea.url} className="rounded-2xl border border-border bg-bg p-3">
                    <p className="font-semibold">{idea.title}</p>
                    <p className="text-xs text-muted">{idea.site}</p>
                    {idea.uses.length > 0 && <p className="mt-1 text-xs text-ok">uses {idea.uses.join(", ")}</p>}
                    {idea.why && <p className="mt-1 text-sm">{idea.why}</p>}
                    <div className="mt-2 flex gap-2">
                      <a
                        href={idea.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex min-h-11 flex-1 items-center justify-center rounded-xl border border-border text-sm font-medium"
                      >
                        Look ↗
                      </a>
                      <button
                        type="button"
                        onClick={() => onSaveLink({ title: idea.title, url: idea.url })}
                        aria-label={`Save ${idea.title}`}
                        className="min-h-11 flex-1 rounded-xl bg-accent text-sm font-semibold text-on-accent"
                      >
                        Save
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}
    </Sheet>
  );
}
