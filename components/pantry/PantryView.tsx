"use client";

import { useState } from "react";
import { addStaple, removeStaple } from "@/lib/data/pantry";
import { checkNewStaple, sortStaples, suggestStaples } from "@/lib/model/pantry";

/** Staples you always have. They'll stay off shopping lists once those arrive. */
export default function PantryView({ uid, items, pending }: { uid: string; items: string[]; pending: boolean }) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const suggestions = suggestStaples(items);

  function add(raw: string) {
    const check = checkNewStaple(items, raw);
    if (!check.ok) {
      setError(check.error);
      return;
    }
    addStaple(uid, check.item);
    setDraft("");
    setError(null);
  }

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-lg font-semibold">Pantry staples</h2>
        <p className="mt-1 text-sm text-muted">
          Things you always have. They&apos;ll stay off your shopping lists unless you ask for them.
        </p>

        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            add(draft);
          }}
        >
          <input
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setError(null);
            }}
            placeholder="cumin, honey, eggs..."
            aria-label="New staple"
            autoCapitalize="none"
            className="block min-h-12 w-full rounded-xl border border-border bg-surface px-3 text-base outline-none focus:border-accent"
          />
          <button type="submit" className="min-h-12 shrink-0 rounded-xl bg-accent px-5 font-semibold text-on-accent">
            Add
          </button>
        </form>
        {error && (
          <p role="alert" className="mt-2 text-sm text-warn">
            {error}
          </p>
        )}
      </section>

      <section aria-label="Your staples">
        {items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted">
            Nothing here yet. Add a few, or tap the ideas below.
          </p>
        ) : (
          <>
            <ul className="flex flex-wrap gap-2">
              {sortStaples(items).map((item) => (
                <li
                  key={item}
                  className="flex min-h-11 items-center gap-1 rounded-full bg-accent-soft py-1 pl-4 pr-1 text-sm font-medium text-accent"
                >
                  {item}
                  <button
                    type="button"
                    aria-label={`Remove ${item}`}
                    onClick={() => removeStaple(uid, item)}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-lg"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
            {pending && <p className="mt-3 text-xs text-warn">Saved on this phone, waiting to sync.</p>}
          </>
        )}
      </section>

      {suggestions.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-muted">Ideas</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  onClick={() => add(s)}
                  aria-label={`Add ${s}`}
                  className="min-h-11 rounded-full border border-border bg-surface px-4 text-sm"
                >
                  + {s}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
