"use client";

import { getFirebase } from "@/lib/firebase/client";

/**
 * Call one of our /api routes from the phone, with the signed-in user's
 * token. Returns a friendly error instead of throwing.
 */
export type AiCall<T> = { ok: true; data: T } | { ok: false; error: string };

export async function callAi<T>(path: string, body: unknown): Promise<AiCall<T>> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { ok: false, error: "This needs signal. Try again when you're back online." };
  }
  const user = getFirebase()?.auth.currentUser;
  if (!user) return { ok: false, error: "Sign in first." };
  try {
    const token = await user.getIdToken();
    const res = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) return { ok: false, error: json.error ?? `Something went wrong (${res.status}).` };
    return { ok: true, data: json as T };
  } catch {
    return { ok: false, error: "Lost the connection. Try again when you have signal." };
  }
}

/** A web picture fetched through our server (other sites block the phone from reading them). Null if it can't be had. */
export async function fetchImageBlob(url: string): Promise<Blob | null> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return null;
  const user = getFirebase()?.auth.currentUser;
  if (!user) return null;
  try {
    const token = await user.getIdToken();
    const res = await fetch("/api/image", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) return null;
    const blob = await res.blob();
    return blob.type.startsWith("image/") ? blob : null;
  } catch {
    return null;
  }
}
