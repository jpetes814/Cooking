"use client";

import { useState } from "react";
import { formatAmount, formatQty, parseLink, SITE_LABEL, type Recipe } from "@/lib/model/recipe";
import { sortedPhotos } from "@/lib/model/photos";
import RecipePhoto from "./RecipePhoto";
import PhotoViewer from "./PhotoViewer";
import { TagLabel } from "./TagPicker";
import CookedPanel from "./CookedPanel";

/** One recipe, readable while cooking. */
export default function RecipeDetail({
  uid,
  recipe,
  onBack,
  onTag,
  onEdit,
  onDelete,
  onRate,
  onCooked,
  onUndoCooked,
}: {
  uid: string;
  recipe: Recipe;
  onBack: () => void;
  /** Show every recipe with this tag. */
  onTag: (tag: string) => void;
  onEdit: () => void;
  onDelete: () => void;
  onRate: (rating: number | null) => void;
  onCooked: (at: number) => void;
  onUndoCooked: (at: number) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const photos = sortedPhotos(recipe.photos);
  const viewed = photos.find((p) => p.id === viewing) ?? null;
  const link = recipe.source.url ? parseLink(recipe.source.url) : null;

  return (
    <article className="space-y-6">
      <div className="flex items-center justify-between">
        <button type="button" onClick={onBack} className="min-h-11 pr-3 text-sm font-medium text-accent">
          ‹ All recipes
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="min-h-11 rounded-xl border border-border px-4 text-sm font-medium"
        >
          Edit
        </button>
      </div>

      {photos.length > 0 && (
        <section aria-label="Photos" className="space-y-2">
          <button type="button" onClick={() => setViewing(photos[0].id)} className="block w-full" aria-label="Open photo 1">
            <RecipePhoto uid={uid} recipeId={recipe.id} photo={photos[0]} alt={recipe.title} className="aspect-[4/3] w-full rounded-2xl" />
          </button>
          {photos.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {photos.slice(1).map((p, i) => (
                <button key={p.id} type="button" onClick={() => setViewing(p.id)} aria-label={`Open photo ${i + 2}`} className="shrink-0">
                  <RecipePhoto uid={uid} recipeId={recipe.id} photo={p} alt="" className="h-20 w-20 rounded-xl" />
                </button>
              ))}
            </div>
          )}
        </section>
      )}
      {viewed && (
        <PhotoViewer uid={uid} recipeId={recipe.id} photo={viewed} title={recipe.title} onClose={() => setViewing(null)} />
      )}

      <header>
        <h2 className="text-2xl font-bold tracking-tight">{recipe.title}</h2>
        <p className="mt-1 text-sm text-muted">
          {recipe.servings !== null && `Serves ${formatQty(recipe.servings)}`}
          {recipe.pending && (
            <span className="text-warn">{recipe.servings !== null ? " · " : ""}Saved on this phone, waiting to sync</span>
          )}
        </p>
        {recipe.tags.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2" aria-label="Tags">
            {recipe.tags.map((t) => (
              <li key={t}>
                <button
                  type="button"
                  onClick={() => onTag(t)}
                  aria-label={`More recipes tagged ${t}`}
                  className="min-h-9 rounded-full bg-accent-soft px-3 text-sm font-medium text-accent"
                >
                  <TagLabel tag={t} />
                </button>
              </li>
            ))}
          </ul>
        )}
        {link?.ok && (
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex min-h-12 items-center justify-center rounded-xl bg-accent-soft font-semibold text-accent"
          >
            Watch on {SITE_LABEL[link.site]} ↗
          </a>
        )}
      </header>

      <CookedPanel recipe={recipe} onRate={onRate} onCooked={onCooked} onUndoCooked={onUndoCooked} />

      {recipe.ingredients.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold">Ingredients</h3>
          <ul className="mt-2 divide-y divide-border rounded-2xl border border-border bg-surface">
            {recipe.ingredients.map((ing, i) => (
              <li key={i} className="px-4 py-3 text-base">
                {ing.qty !== null ? (
                  <>
                    <span className="font-semibold">{formatAmount(ing)}</span>{" "}
                    {ing.name}
                  </>
                ) : (
                  ing.raw
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {recipe.steps.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold">Steps</h3>
          <ol className="mt-2 space-y-3">
            {recipe.steps.map((step, i) => (
              <li key={i} className="flex gap-3 text-base leading-relaxed">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-bold text-accent">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {recipe.notes && (
        <section>
          <h3 className="text-lg font-semibold">Notes</h3>
          <p className="mt-2 whitespace-pre-line text-base leading-relaxed">{recipe.notes}</p>
        </section>
      )}

      {recipe.ingredients.length === 0 && recipe.steps.length === 0 && photos.length === 0 && (
        <p className="rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted">
          Just the {link?.ok ? "link" : "name"} for now. Tap Edit to add ingredients and steps.
        </p>
      )}

      <div className="border-t border-border pt-4">
        {confirming ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="min-h-12 flex-1 rounded-xl border border-border font-medium"
            >
              Keep it
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="min-h-12 flex-1 rounded-xl bg-warn font-semibold text-on-accent"
            >
              Yes, delete
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirming(true)} className="min-h-12 w-full text-sm font-medium text-warn">
            Delete recipe
          </button>
        )}
      </div>
    </article>
  );
}
