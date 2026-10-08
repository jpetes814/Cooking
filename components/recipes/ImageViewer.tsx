"use client";

import { useEffect } from "react";

/** Any picture filling the screen: for checking a recipe against its photo. */
export default function ImageViewer({ src, alt, onClose }: { src: string | null; alt: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="pt-safe pb-safe fixed inset-0 z-50 flex flex-col bg-black" role="dialog" aria-modal="true" aria-label="Photo">
      <div className="flex justify-end p-2">
        <button type="button" onClick={onClose} className="min-h-11 min-w-11 px-3 text-sm font-medium text-white">
          Close
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center p-2">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element -- a local or Firebase photo, not a hosted asset
          <img src={src} alt={alt} className="max-h-full max-w-full object-contain" />
        ) : (
          <p className="text-sm text-white/70">This photo is still on its way.</p>
        )}
      </div>
    </div>
  );
}
