"use client";

import { doc, updateDoc } from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { getFirebase } from "@/lib/firebase/client";
import { allItems, getItem, putItem, removeItem, type QueueItem } from "@/lib/photos/store";
import { syncStore } from "./sync";

/**
 * Every photo upload, download address, and delete. Photos are kept on the
 * phone (lib/photos/store.ts) until the upload succeeds, so adding one with no
 * signal works like everything else: it shows right away, waits, and goes up
 * when there's signal. The recipe gets the download address once it's up.
 */

export function newPhotoId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().replace(/-/g, "").slice(0, 20)
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function report(count: number) {
  // Joins the status line's "waiting to sync" count. Never marks anything synced.
  syncStore().report("photos", { pendingWrites: count, fromServer: false }, Date.now());
}

let draining: Promise<void> | null = null;
let again = false;

function errorCode(err: unknown): string {
  return (err as { code?: string })?.code ?? "";
}

async function upload(item: Extract<QueueItem, { kind: "upload" }>): Promise<boolean> {
  const fb = getFirebase();
  if (!fb?.storage) return false;
  const fileRef = ref(fb.storage, item.path);
  try {
    await uploadBytes(fileRef, item.blob, { contentType: "image/jpeg" });
  } catch (err) {
    // A retry after an upload that finished but wasn't marked done: the rules
    // refuse overwrites, so check whether the file is already there.
    if (errorCode(err) !== "storage/unauthorized") return false;
    try {
      await getDownloadURL(fileRef);
    } catch {
      return false;
    }
  }
  let url: string;
  try {
    url = await getDownloadURL(fileRef);
  } catch {
    return false;
  }
  try {
    await updateDoc(doc(fb.db, `users/${item.uid}/recipes/${item.recipeId}`), { [`photos.${item.id}.url`]: url });
  } catch (err) {
    // The recipe was deleted while the photo waited: don't leave the file behind.
    if (errorCode(err) === "not-found") await deleteObject(fileRef).catch(() => {});
    else return false;
  }
  return true;
}

async function remove(item: Extract<QueueItem, { kind: "delete" }>): Promise<boolean> {
  const fb = getFirebase();
  if (!fb?.storage) return false;
  try {
    await deleteObject(ref(fb.storage, item.path));
    return true;
  } catch (err) {
    return errorCode(err) === "storage/object-not-found";
  }
}

async function drainOnce(uid: string) {
  const items = (await allItems()).filter((i) => i.uid === uid);
  report(items.length);
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  let left = items.length;
  for (const item of items) {
    const done = item.kind === "upload" ? await upload(item) : await remove(item);
    if (!done) continue;
    await removeItem(item.id);
    report(--left);
  }
}

/** Sends everything waiting on this phone. Safe to call often; runs one at a time. */
export function drainPhotos(uid: string): Promise<void> {
  if (draining) {
    again = true;
    return draining;
  }
  draining = (async () => {
    do {
      again = false;
      await drainOnce(uid);
    } while (again);
  })().finally(() => {
    draining = null;
  });
  return draining;
}

/** Keeps new photos on the phone and starts uploading them. */
export async function queueUploads(uid: string, recipeId: string, photos: { id: string; path: string; blob: Blob }[]) {
  const now = Date.now();
  for (const [i, p] of photos.entries()) {
    await putItem({ id: p.id, kind: "upload", uid, recipeId, path: p.path, blob: p.blob, addedAt: now + i });
  }
  void drainPhotos(uid);
}

/**
 * Deletes photo files. A photo still waiting to upload is simply dropped from
 * the phone; one already uploaded is deleted from Storage when there's signal.
 */
export async function queueDeletes(uid: string, photos: { id: string; path: string }[]) {
  const now = Date.now();
  for (const [i, p] of photos.entries()) {
    const waiting = await getItem(p.id);
    if (waiting?.kind === "upload") {
      await removeItem(p.id);
      // It may have finished uploading a moment ago; delete it to be sure.
    }
    await putItem({ id: `del-${p.id}`, kind: "delete", uid, path: p.path, addedAt: now + i });
  }
  void drainPhotos(uid);
}

/** The photo as it sits on this phone, if it hasn't been uploaded yet. */
export async function localPhoto(id: string): Promise<Blob | null> {
  const item = await getItem(id);
  return item?.kind === "upload" ? item.blob : null;
}

/** A download address for a photo whose recipe never got one (a sync race). */
export async function fetchPhotoUrl(uid: string, recipeId: string, id: string, path: string): Promise<string | null> {
  const fb = getFirebase();
  if (!fb?.storage) return null;
  try {
    const url = await getDownloadURL(ref(fb.storage, path));
    updateDoc(doc(fb.db, `users/${uid}/recipes/${recipeId}`), { [`photos.${id}.url`]: url }).catch(() => {});
    return url;
  } catch {
    return null;
  }
}

export function photosEnabled(): boolean {
  return Boolean(getFirebase()?.storage);
}
