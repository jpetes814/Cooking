/**
 * Recipe photos: which ones a recipe has, and how big to make them before
 * upload. Pure so it can be tested without a browser or Firebase.
 */

export const MAX_PHOTOS = 10;
/** Longest side after shrinking. Sharp on a phone, small enough to upload on weak signal. */
export const MAX_PHOTO_SIDE = 1600;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export interface PhotoEntry {
  /** Where the file lives in Storage: users/{uid}/photos/{id}.jpg */
  path: string;
  /** Download address once it's uploaded; null while it waits on this phone. */
  url: string | null;
  addedAt: number;
}

export type PhotoMap = Record<string, PhotoEntry>;

export function photoPath(uid: string, id: string): string {
  return `users/${uid}/photos/${id}.jpg`;
}

/** Oldest first, so the first photo you added stays the cover. */
export function sortedPhotos(map: PhotoMap | undefined): (PhotoEntry & { id: string })[] {
  return Object.entries(map ?? {})
    .map(([id, p]) => ({ ...p, id }))
    .sort((a, b) => a.addedAt - b.addedAt || a.id.localeCompare(b.id));
}

/** The cover photo, if there is one. */
export function coverPhoto(map: PhotoMap | undefined): (PhotoEntry & { id: string }) | null {
  return sortedPhotos(map)[0] ?? null;
}

/** How many more photos fit. */
export function roomFor(map: PhotoMap | undefined): number {
  return Math.max(0, MAX_PHOTOS - Object.keys(map ?? {}).length);
}

/** Scales a width and height down to fit within `max` on the longest side. Never scales up. */
export function fitWithin(width: number, height: number, max = MAX_PHOTO_SIDE): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width: 0, height: 0 };
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** Changes to a recipe's photos made in the editor, applied at save time. */
export function applyPhotoEdits(
  current: PhotoMap | undefined,
  edits: { add: { id: string; path: string }[]; remove: string[] },
  now: number
): PhotoMap {
  const next: PhotoMap = { ...(current ?? {}) };
  for (const id of edits.remove) delete next[id];
  edits.add.forEach((p, i) => {
    if (Object.keys(next).length < MAX_PHOTOS) next[p.id] = { path: p.path, url: null, addedAt: now + i };
  });
  return next;
}
