"use client";

import { useState } from "react";
import { TextInput } from "@/components/ui/fields";
import { createTrip } from "@/lib/data/trips";
import type { Recipe } from "@/lib/model/recipe";
import { defaultTripName, newTrip, progress, type Trip } from "@/lib/model/trip";
import { shoppingList } from "@/lib/shop/merge";
import { useNow } from "@/components/shell/useNow";
import RecipePicker from "./RecipePicker";
import TripView from "./TripView";

/** The Shop tab: your trips, and one trip's list at a time. */
export default function ShopView({ uid, trips, recipes, staples }: { uid: string; trips: Trip[]; recipes: Recipe[]; staples: string[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const open = trips.find((t) => t.id === openId) ?? null;
  const now = useNow();

  if (open) {
    return <TripView key={open.id} uid={uid} trip={open} recipes={recipes} staples={staples} onBack={() => setOpenId(null)} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Shopping trips</h2>
        <button
          type="button"
          onClick={() => {
            setName("");
            setCreating(true);
          }}
          className="min-h-11 shrink-0 rounded-xl bg-accent px-4 font-semibold text-on-accent"
        >
          + New trip
        </button>
      </div>

      {trips.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm leading-relaxed text-muted">
          Pick a few recipes and get one list, with the same ingredients added up and grouped by aisle. Check things off in
          the store, even with no signal.
        </p>
      ) : (
        <ul className="space-y-2" aria-label="Your trips">
          {trips.map((t) => {
            const forTrip = recipes.filter((r) => t.recipeIds.includes(r.id));
            const keys = shoppingList(forTrip, t.extras, staples).aisles.flatMap((a) => a.items.map((i) => i.key));
            const { left } = progress(keys, t.checked);
            return (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(t.id)}
                  className="flex min-h-16 w-full flex-col justify-center rounded-2xl border border-border bg-surface px-4 py-2 text-left"
                >
                  <span className="font-semibold">{t.name}</span>
                  <span className="text-xs text-muted">
                    {forTrip.length} recipe{forTrip.length === 1 ? "" : "s"} ·{" "}
                    {keys.length === 0 ? "nothing to buy yet" : left === 0 ? "all in the cart" : `${left} to get`}
                    {t.pending && <span className="text-warn"> · waiting to sync</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {creating && (
        <RecipePicker
          title="New trip"
          recipes={recipes}
          initial={[]}
          doneLabel={(n) => (n ? `Make a list for ${n} recipe${n === 1 ? "" : "s"}` : "Start an empty list")}
          onClose={() => setCreating(false)}
          onDone={(ids) => {
            const id = createTrip(uid, newTrip(name, ids, Date.now()));
            setCreating(false);
            setOpenId(id);
          }}
        >
          <div className="mb-3">
            <TextInput label="Name" value={name} onChange={setName} placeholder={defaultTripName(now)} />
          </div>
        </RecipePicker>
      )}
    </div>
  );
}
