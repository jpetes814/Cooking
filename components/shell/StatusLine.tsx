"use client";

import { connectionLabel } from "@/lib/connection";
import { useOnline } from "./useOnline";
import { useNow } from "./useNow";

const TONE: Record<string, string> = {
  ok: "text-ok",
  warn: "text-warn",
  muted: "text-muted",
};

/**
 * One line under the header: online or offline. Sync counts join in once
 * recipes are saved to Firestore (lib/data/sync.ts).
 */
export default function StatusLine() {
  const online = useOnline();
  const now = useNow();
  const { text, tone } = connectionLabel({ online, pendingWrites: 0, lastSyncedAt: null }, now);
  return (
    <p data-testid="status-line" className={`text-xs font-medium ${TONE[tone]}`}>
      <span aria-hidden className="mr-1">●</span>
      {text}
    </p>
  );
}
