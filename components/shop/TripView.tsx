"use client";

import { useMemo, useState } from "react";
import { inputClass } from "@/components/ui/fields";
import Stepper from "@/components/ui/Stepper";
import { addExtra, deleteTrip, removeExtra, setChecked, setTripRecipes, setTripServings, uncheckAll } from "@/lib/data/trips";
import { canStep, stepTarget, targetLabel } from "@/lib/model/scale";
import type { Recipe } from "@/lib/model/recipe";
import { progress, tidyExtra, tripRecipes, type Trip } from "@/lib/model/trip";
import { shoppingList, type ShopItem } from "@/lib/shop/merge";
import { addsText, leftoverIdeas } from "@/lib/shop/useItUp";
import RecipePicker from "./RecipePicker";

/** One trip's list, by aisle. Tap an item to put it in the cart; it all works with no signal. */
export default function TripView({
  uid,
  trip,
  recipes,
  staples,
  onBack,
}: {
  uid: string;
  trip: Trip;
  recipes: Recipe[];
  staples: string[];
  onBack: () => void;
}) {
  const [picking, setPicking] = useState(false);
  const [draft, setDraft] = useState("");
  const [confirming, setConfirming] = useState(false);
  const forTrip = useMemo(() => tripRecipes(trip, recipes), [trip, recipes]);
  const list = useMemo(() => shoppingList(forTrip, trip.extras, staples), [forTrip, trip.extras, staples]);
  const all = list.aisles.flatMap((a) => a.items);
  const { done, left } = progress(
    all.map((i) => i.key),
    trip.checked
  );
  const inCart = all.filter((i) => trip.checked[i.key]);
  const ideas = useMemo(
    () =>
      leftoverIdeas(
        recipes,
        list.aisles.flatMap((a) => a.items.filter((i) => !i.extra).map((i) => i.key)),
        trip.recipeIds,
        staples
      ),
    [recipes, list, trip.recipeIds, staples]
  );
  const empty = forTrip.filter((r) => r.ingredients.length === 0);

  function addItem(e: React.FormEvent) {
    e.preventDefault();
    const item = tidyExtra(draft, trip.extras);
    if (item) addExtra(uid, trip.id, item);
    setDraft("");
  }

  const row = (item: ShopItem) => {
    const on = Boolean(trip.checked[item.key]);
    return (
      <li key={item.key} className="flex items-stretch">
        <button
          type="button"
          role="checkbox"
          aria-checked={on}
          aria-label={item.name}
          onClick={() => setChecked(uid, trip.id, item.key, !on)}
          className="flex min-h-14 flex-1 items-center gap-3 px-3 py-2 text-left"
        >
          <span
            aria-hidden
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 text-sm ${
              on ? "border-accent bg-accent text-on-accent" : "border-border"
            }`}
          >
            {on ? "✓" : ""}
          </span>
          <span className={`flex min-w-0 flex-col ${on ? "text-muted line-through" : ""}`}>
            <span className="text-base">
              {item.amount && <span className="font-semibold">{item.amount} </span>}
              {item.name}
            </span>
            {item.recipes.length > 0 && <span className="truncate text-xs text-muted no-underline">{item.recipes.join(" · ")}</span>}
          </span>
        </button>
        {item.extra && (
          <button
            type="button"
            aria-label={`Remove ${item.name}`}
            onClick={() => removeExtra(uid, trip.id, item.name)}
            className="min-h-14 min-w-11 px-3 text-lg text-muted"
          >
            ×
          </button>
        )}
      </li>
    );
  };

  return (
    <article className="space-y-5">
      <div className="flex items-center justify-between">
        <button type="button" onClick={onBack} className="min-h-11 pr-3 text-sm font-medium text-accent">
          ‹ All trips
        </button>
        <button type="button" onClick={() => setPicking(true)} className="min-h-11 rounded-xl border border-border px-4 text-sm font-medium">
          Change recipes
        </button>
      </div>

      <header>
        <h2 className="text-2xl font-bold tracking-tight">{trip.name}</h2>
        <p className="mt-1 text-sm text-muted" data-testid="trip-progress">
          {all.length === 0 ? "Nothing to buy yet" : left === 0 ? "All in the cart" : `${left} to get · ${done} in the cart`}
          {trip.pending && <span className="text-warn"> · waiting to sync</span>}
        </p>
        {forTrip.length > 0 && (
          <ul aria-label="Recipes on this trip" className="mt-3 divide-y divide-border rounded-2xl border border-border bg-surface">
            {forTrip.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 py-1 pl-3 pr-1">
                <span className="min-w-0 truncate text-sm font-medium">{r.title}</span>
                <Stepper
                  value={targetLabel(r.target, r.servings)}
                  label={`How much ${r.title} to shop for`}
                  onStep={(dir) => setTripServings(uid, trip.id, r.id, stepTarget(r.target, dir, r.servings))}
                  canDown={canStep(r.target, -1, r.servings)}
                  canUp={canStep(r.target, 1, r.servings)}
                />
              </li>
            ))}
          </ul>
        )}
        {empty.length > 0 && (
          <p className="mt-1 text-xs text-warn">
            {empty.map((r) => r.title).join(", ")} {empty.length === 1 ? "has" : "have"} no ingredients yet, so {empty.length === 1 ? "it isn't" : "they aren't"} on the list.
          </p>
        )}
      </header>

      {list.aisles.map(({ aisle, items }) => {
        const toGet = items.filter((i) => !trip.checked[i.key]);
        if (!toGet.length) return null;
        return (
          <section key={aisle} aria-label={aisle}>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">{aisle}</h3>
            <ul className="mt-1 divide-y divide-border rounded-2xl border border-border bg-surface">{toGet.map(row)}</ul>
          </section>
        );
      })}

      {ideas.length > 0 && (
        <section aria-label="Use it up" className="rounded-2xl border border-accent bg-accent-soft p-3">
          <h3 className="font-semibold text-accent">Use it up</h3>
          <p className="text-xs text-muted">Other recipes that use what you&apos;re already buying, so less goes to waste.</p>
          <ul className="mt-2 space-y-2">
            {ideas.map(({ recipe: r, shares, adds }) => (
              <li key={r.id} className="flex items-center gap-2 rounded-xl bg-surface p-3">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-medium">{r.title}</span>
                  <span className="text-xs text-ok">uses {shares.join(", ")}</span>
                  <span className="text-xs text-muted">{addsText(adds)}</span>
                </span>
                <button
                  type="button"
                  aria-label={`Add ${r.title} to this trip`}
                  onClick={() => setTripRecipes(uid, trip.id, [...trip.recipeIds, r.id])}
                  className="min-h-11 shrink-0 rounded-xl bg-accent px-3 text-sm font-semibold text-on-accent"
                >
                  Add to trip
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <form onSubmit={addItem} className="flex items-end gap-2">
        <label className="block flex-1">
          <span className="text-sm font-medium">Add something else</span>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Paper towels" enterKeyHint="done" className={inputClass} />
        </label>
        <button type="submit" className="min-h-12 shrink-0 rounded-xl bg-accent px-4 font-semibold text-on-accent">
          Add
        </button>
      </form>

      {inCart.length > 0 && (
        <section aria-label="In the cart">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">In the cart · {inCart.length}</h3>
            <button type="button" onClick={() => uncheckAll(uid, trip.id)} className="min-h-11 px-2 text-sm font-medium text-accent">
              Uncheck all
            </button>
          </div>
          <ul className="mt-1 divide-y divide-border rounded-2xl border border-border bg-surface">{inCart.map(row)}</ul>
        </section>
      )}

      {list.staples.length > 0 && (
        <section aria-label="Probably at home">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Probably at home</h3>
          <p className="mt-1 text-sm text-muted">
            On your pantry list: {list.staples.map((s) => (s.amount ? `${s.name} (${s.amount})` : s.name)).join(", ")}.
          </p>
        </section>
      )}

      <div className="border-t border-border pt-4">
        {confirming ? (
          <div className="flex gap-2">
            <button type="button" onClick={() => setConfirming(false)} className="min-h-12 flex-1 rounded-xl border border-border font-medium">
              Keep it
            </button>
            <button
              type="button"
              onClick={() => {
                deleteTrip(uid, trip.id);
                onBack();
              }}
              className="min-h-12 flex-1 rounded-xl bg-warn font-semibold text-on-accent"
            >
              Yes, delete
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirming(true)} className="min-h-12 w-full text-sm font-medium text-warn">
            Delete trip
          </button>
        )}
      </div>

      {picking && (
        <RecipePicker
          title="Recipes for this trip"
          recipes={recipes}
          initial={trip.recipeIds.filter((id) => recipes.some((r) => r.id === id))}
          doneLabel={(n) => (n ? `Shop for ${n} recipe${n === 1 ? "" : "s"}` : "Shop for no recipes")}
          onClose={() => setPicking(false)}
          onDone={(ids) => {
            setTripRecipes(
              uid,
              trip.id,
              ids,
              trip.recipeIds.filter((id) => !ids.includes(id))
            );
            setPicking(false);
          }}
        />
      )}
    </article>
  );
}
