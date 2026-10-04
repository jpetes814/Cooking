"use client";

/**
 * Photos waiting on this phone, in IndexedDB. Uploads to Firebase Storage don't
 * queue up offline the way Firestore writes do, so the app keeps its own list:
 * each photo stays here until its upload succeeds, and deletes of photos that
 * were already uploaded wait here too. Every call fails soft (private mode,
 * storage blocked): the caller gets an empty result instead of an error.
 */

export type QueueItem =
  | { id: string; kind: "upload"; uid: string; recipeId: string; path: string; blob: Blob; addedAt: number }
  | { id: string; kind: "delete"; uid: string; path: string; addedAt: number };

const DB = "recipe-box-photos";
const STORE = "queue";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function putItem(item: QueueItem): Promise<boolean> {
  try {
    await run("readwrite", (s) => s.put(item));
    return true;
  } catch {
    return false;
  }
}

export async function removeItem(id: string): Promise<void> {
  try {
    await run("readwrite", (s) => s.delete(id));
  } catch {
    // Nothing to do; it'll be retried and found gone.
  }
}

export async function allItems(): Promise<QueueItem[]> {
  try {
    const items = await run<QueueItem[]>("readonly", (s) => s.getAll());
    return items.sort((a, b) => a.addedAt - b.addedAt);
  } catch {
    return [];
  }
}

export async function getItem(id: string): Promise<QueueItem | null> {
  try {
    return ((await run("readonly", (s) => s.get(id))) as QueueItem | undefined) ?? null;
  } catch {
    return null;
  }
}
