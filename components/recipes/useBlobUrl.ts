"use client";

import { useEffect, useState } from "react";

/** A temporary address for a photo still on this phone, cleaned up when no longer shown. */
export function useBlobUrl(blob: Blob | null): string | null {
  const [url, setUrl] = useState<{ blob: Blob; url: string } | null>(null);
  useEffect(() => {
    if (!blob) return;
    const u = URL.createObjectURL(blob);
    // Created in the effect so it can be revoked when the photo goes away.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrl({ blob, url: u });
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return blob && url?.blob === blob ? url.url : null;
}
