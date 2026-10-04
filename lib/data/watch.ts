"use client";

import {
  collection,
  doc,
  onSnapshot,
  query,
  type DocumentSnapshot,
  type FirestoreError,
  type QuerySnapshot,
  type QueryConstraint,
} from "firebase/firestore";
import { getFirebase } from "@/lib/firebase/client";
import { syncStore } from "./sync";

/**
 * Live listeners, offline-first, that report unsynced writes to the status
 * line. If the server refuses or drops the listener, it reports the error and
 * tries again with a growing delay (a fresh sign-in can take a moment to reach
 * the server).
 */
function listen<S extends DocumentSnapshot | QuerySnapshot>(
  key: string,
  subscribe: (onNext: (snap: S) => void, onErr: (err: FirestoreError) => void) => () => void,
  onSnap: (snap: S) => number,
  onError?: (err: FirestoreError) => void
): () => void {
  let stop: (() => void) | null = null;
  let retry: ReturnType<typeof setTimeout> | null = null;
  let attempt = 0;
  let closed = false;

  const start = () => {
    stop = subscribe(
      (snap) => {
        attempt = 0;
        const pendingWrites = onSnap(snap);
        syncStore().report(key, { pendingWrites, fromServer: !snap.metadata.fromCache }, Date.now());
      },
      (err) => {
        onError?.(err);
        if (closed) return;
        const delay = Math.min(30_000, 1000 * 2 ** attempt++);
        retry = setTimeout(start, delay);
      }
    );
  };
  start();

  return () => {
    closed = true;
    if (retry) clearTimeout(retry);
    stop?.();
    syncStore().forget(key);
  };
}

/** Live view of a collection. Every record gets its id and a `pending` flag. */
export function watchCollection<T>(
  path: string,
  key: string,
  constraints: QueryConstraint[],
  onData: (rows: (T & { id: string; pending: boolean })[]) => void,
  onError?: (err: FirestoreError) => void
): () => void {
  const fb = getFirebase();
  if (!fb) return () => {};
  return listen<QuerySnapshot>(
    key,
    (next, err) => onSnapshot(query(collection(fb.db, path), ...constraints), { includeMetadataChanges: true }, next, err),
    (snap) => {
      const rows = snap.docs.map((d) => ({ ...(d.data() as T), id: d.id, pending: d.metadata.hasPendingWrites }));
      onData(rows);
      return rows.filter((r) => r.pending).length;
    },
    onError
  );
}

/** Live view of one document: null until it exists, plus a `pending` flag. */
export function watchDoc<T>(
  path: string,
  key: string,
  onData: (data: T | null, pending: boolean) => void,
  onError?: (err: FirestoreError) => void
): () => void {
  const fb = getFirebase();
  if (!fb) return () => {};
  return listen<DocumentSnapshot>(
    key,
    (next, err) => onSnapshot(doc(fb.db, path), { includeMetadataChanges: true }, next, err),
    (snap) => {
      const pending = snap.metadata.hasPendingWrites;
      onData(snap.exists() ? (snap.data() as T) : null, pending);
      return pending ? 1 : 0;
    },
    onError
  );
}
