"use client";

import { useState } from "react";
import { formatAmount, formatQty, parseLink, SITE_LABEL, type RecipeDoc } from "@/lib/model/recipe";
import { missingAmounts, type ReviewNote } from "@/lib/model/review";
import type { PhotoEntry } from "@/lib/model/photos";
import RecipePhoto from "./RecipePhoto";
import PhotoViewer from "./PhotoViewer";
import ImageViewer from "./ImageViewer";
import { TagLabel } from "./TagPicker";
import { useBlobUrl } from "./useBlobUrl";
import type { NewPhoto } from "./PhotoPicker";

function NewPhotoImg({ photo, className }: { photo: NewPhoto; className: string }) {
  const src = useBlobUrl(photo.blob);
  // eslint-disable-next-line @next/next/no-img-element -- a local preview, not a hosted image
  return src ? <img src={src} alt="" className={`bg-surface-2 object-cover ${className}`} /> : <div className={`bg-surface-2 ${className}`} />;
}

function NewPhotoViewer({ photo, onClose }: { photo: NewPhoto; onClose: () => void }) {
  return <ImageViewer src={useBlobUrl(photo.blob)} alt="Recipe photo" onClose={onClose} />;
}

/**
 * The recipe as it will look once saved, with anything worth a second look
 * pointed out. Tap a photo to compare it with the text.
 */
export default function RecipePreview({
  uid,
  recipeId,
  recipe,
  kept,
  added,
  notes,
  claudeTags,
}: {
  uid: string;
  recipeId: string | null;
  recipe: RecipeDoc;
  kept: (PhotoEntry & { id: string })[];
  added: NewPhoto[];
  notes: ReviewNote[];
  claudeTags: readonly string[];
}) {
  const [viewing, setViewing] = useState<string | null>(null);
  const link = recipe.source.url ? parseLink(recipe.source.url) : null;
  const missing = new Set(missingAmounts(recipe));
  const photos = [
    ...kept.map((p) => ({ id: p.id, kept: p, added: null as NewPhoto | null })),
    ...added.map((p) => ({ id: p.id, kept: null, added: p })),
  ];
  const viewed = photos.find((p) => p.id === viewing);

  return (
    <div className="space-y-5" data-testid="recipe-preview">
      {notes.length > 0 && (
        <ul className="space-y-1 rounded-2xl border border-warn/40 bg-surface-2 p-3 text-sm" aria-label="Worth checking">
          {notes.map((n) => (
            <li key={n.text} className="flex gap-2">
              <span aria-hidden>{n.kind === "ai" ? "✨" : n.kind === "amount" ? "⚖️" : "•"}</span>
              <span>{n.text}</span>
            </li>
          ))}
        </ul>
      )}

      {photos.length > 0 && (
        <section aria-label="Photos to compare">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {photos.map((p, i) => (
              <button key={p.id} type="button" onClick={() => setViewing(p.id)} aria-label={`Compare with photo ${i + 1}`} className="shrink-0">
                {p.kept && recipeId ? (
                  <RecipePhoto uid={uid} recipeId={recipeId} photo={p.kept} alt="" className="h-24 w-24 rounded-xl" />
                ) : p.added ? (
                  <NewPhotoImg photo={p.added} className="h-24 w-24 rounded-xl" />
                ) : null}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-muted">Tap a photo to see it full size.</p>
        </section>
      )}
      {viewed?.kept && recipeId && (
        <PhotoViewer uid={uid} recipeId={recipeId} photo={viewed.kept} title={recipe.title} onClose={() => setViewing(null)} />
      )}
      {viewed?.added && <NewPhotoViewer photo={viewed.added} onClose={() => setViewing(null)} />}

      <header>
        <h3 className="text-2xl font-bold tracking-tight">{recipe.title}</h3>
        {recipe.servings !== null && <p className="mt-1 text-sm text-muted">Serves {formatQty(recipe.servings)}</p>}
        {recipe.tags.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-2" aria-label="Tags to save">
            {recipe.tags.map((t) => (
              <li key={t} className="rounded-full bg-accent-soft px-3 py-1.5 text-sm font-medium text-accent">
                <TagLabel tag={t} />
                {claudeTags.includes(t) && (
                  <span className="ml-1" aria-label="suggested by Claude">
                    ✨
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        {link?.ok && <p className="mt-2 text-sm text-accent">Link: {SITE_LABEL[link.site]} ↗</p>}
      </header>

      {recipe.ingredients.length > 0 && (
        <section>
          <h4 className="font-semibold">Ingredients</h4>
          <ul className="mt-1 divide-y divide-border rounded-2xl border border-border bg-surface">
            {recipe.ingredients.map((ing, i) => (
              <li key={i} className={`px-3 py-2 ${missing.has(ing.raw) ? "bg-surface-2" : ""}`}>
                {ing.qty !== null ? (
                  <>
                    <span className="font-semibold">{formatAmount(ing)}</span> {ing.name}
                  </>
                ) : (
                  ing.raw
                )}
                {missing.has(ing.raw) && <span className="ml-2 text-xs text-warn">no amount</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {recipe.steps.length > 0 && (
        <section>
          <h4 className="font-semibold">Steps</h4>
          <ol className="mt-1 list-decimal space-y-1 pl-5">
            {recipe.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </section>
      )}

      {recipe.notes && (
        <section>
          <h4 className="font-semibold">Notes</h4>
          <p className="mt-1 whitespace-pre-line">{recipe.notes}</p>
        </section>
      )}
    </div>
  );
}
