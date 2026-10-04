"use client";

import { useEffect, useState } from "react";
import { newPhotoId, photosEnabled } from "@/lib/data/photos";
import { shrinkPhoto } from "@/lib/photos/shrink";
import type { PhotoEntry } from "@/lib/model/photos";
import RecipePhoto from "./RecipePhoto";

export interface NewPhoto {
  id: string;
  blob: Blob;
}

/** Thumbnail for a photo picked in this editor but not saved yet. */
function NewThumb({ photo }: { photo: NewPhoto }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    const url = URL.createObjectURL(photo.blob);
    // Created in the effect so it can be revoked when the thumbnail goes away.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [photo.blob]);
  // eslint-disable-next-line @next/next/no-img-element -- a local preview, not a hosted image
  return src ? <img src={src} alt="New photo" className="h-full w-full object-cover" /> : null;
}

/**
 * The editor's photo row: what the recipe has, what you just picked, and a
 * button that opens the camera or photo library. Photos are shrunk right away.
 */
export default function PhotoPicker({
  uid,
  recipeId,
  existing,
  added,
  room,
  onAdd,
  onRemoveExisting,
  onRemoveAdded,
}: {
  uid: string;
  recipeId: string | null;
  existing: (PhotoEntry & { id: string })[];
  added: NewPhoto[];
  room: number;
  onAdd: (photos: NewPhoto[]) => void;
  onRemoveExisting: (id: string) => void;
  onRemoveAdded: (id: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!photosEnabled()) {
    return (
      <p className="text-xs text-muted">Photos need Firebase Storage turned on (docs/SETUP.md, section 3, step 8).</p>
    );
  }

  async function pick(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    const ready: NewPhoto[] = [];
    let skipped = 0;
    for (const file of Array.from(files)) {
      if (ready.length >= room) {
        skipped++;
        continue;
      }
      const res = await shrinkPhoto(file);
      if (res.ok) ready.push({ id: newPhotoId(), blob: res.blob });
      else setError(res.error);
    }
    if (skipped) setError(`A recipe can have up to 10 photos, so ${skipped} ${skipped === 1 ? "was" : "were"} left out.`);
    onAdd(ready);
    setBusy(false);
  }

  const count = existing.length + added.length;
  const thumb = "relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-border";
  const removeButton =
    "absolute right-0.5 top-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-lg text-white";

  return (
    <div>
      <span className="text-sm font-medium">Photos</span>
      <div className="mt-1 flex flex-wrap gap-2">
        {existing.map((p, i) => (
          <div key={p.id} className={thumb}>
            {recipeId && <RecipePhoto uid={uid} recipeId={recipeId} photo={p} alt={`Photo ${i + 1}`} className="h-full w-full" />}
            <button type="button" aria-label={`Remove photo ${i + 1}`} onClick={() => onRemoveExisting(p.id)} className={removeButton}>
              ×
            </button>
          </div>
        ))}
        {added.map((p, i) => (
          <div key={p.id} className={thumb}>
            <NewThumb photo={p} />
            <button
              type="button"
              aria-label={`Remove photo ${existing.length + i + 1}`}
              onClick={() => onRemoveAdded(p.id)}
              className={removeButton}
            >
              ×
            </button>
          </div>
        ))}
        {room > 0 && (
          <label
            className={`${thumb} flex cursor-pointer flex-col items-center justify-center border-dashed text-center text-xs font-medium text-accent`}
          >
            <input
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              aria-label="Add photos"
              disabled={busy}
              onChange={(e) => {
                void pick(e.target.files);
                e.target.value = "";
              }}
            />
            <span aria-hidden className="text-2xl leading-none">+</span>
            {busy ? "Getting ready..." : count ? "Add more" : "Add photos"}
          </label>
        )}
      </div>
      <span className="mt-1 block text-xs text-muted">
        A cookbook page, a screenshot, or the finished dish. Saved on this phone first, then uploaded.
      </span>
      {error && (
        <p role="alert" className="mt-1 text-sm text-warn">
          {error}
        </p>
      )}
    </div>
  );
}
