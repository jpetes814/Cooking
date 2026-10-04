"use client";

import { useEffect, useState } from "react";
import { fetchPhotoUrl, localPhoto } from "@/lib/data/photos";
import type { PhotoEntry } from "@/lib/model/photos";
import { useOnline } from "@/components/shell/useOnline";

/**
 * One recipe photo. Uploaded photos load from their download address (the
 * service worker keeps a copy for offline). A photo still waiting on this phone
 * shows from the phone's own copy.
 */
export function usePhotoSrc(uid: string, recipeId: string, photo: PhotoEntry & { id: string }): string | null {
  const online = useOnline();
  const [local, setLocal] = useState<{ id: string; src: string | null } | null>(null);
  const [fetched, setFetched] = useState<{ id: string; src: string | null } | null>(null);

  useEffect(() => {
    if (photo.url) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    localPhoto(photo.id).then((blob) => {
      if (cancelled) return;
      objectUrl = blob ? URL.createObjectURL(blob) : null;
      setLocal({ id: photo.id, src: objectUrl });
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photo.id, photo.url]);

  // Uploaded but the recipe never got its address (rare): look it up once.
  const localSrc = local?.id === photo.id ? local.src : undefined;
  useEffect(() => {
    if (photo.url || localSrc !== null || !online) return;
    let cancelled = false;
    fetchPhotoUrl(uid, recipeId, photo.id, photo.path).then((src) => {
      if (!cancelled) setFetched({ id: photo.id, src });
    });
    return () => {
      cancelled = true;
    };
  }, [uid, recipeId, photo.id, photo.path, photo.url, localSrc, online]);

  if (photo.url) return photo.url;
  if (localSrc) return localSrc;
  return fetched?.id === photo.id ? fetched.src : null;
}

export default function RecipePhoto({
  uid,
  recipeId,
  photo,
  alt,
  className = "",
}: {
  uid: string;
  recipeId: string;
  photo: PhotoEntry & { id: string };
  alt: string;
  className?: string;
}) {
  const src = usePhotoSrc(uid, recipeId, photo);
  if (!src) {
    return (
      <div className={`flex items-center justify-center bg-surface-2 text-xs text-muted ${className}`} role="img" aria-label={alt}>
        Photo
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element -- photos come from Firebase or the phone itself, not next/image
  return <img src={src} alt={alt} className={`bg-surface-2 object-cover ${className}`} />;
}
