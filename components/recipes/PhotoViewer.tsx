"use client";

import { useEffect } from "react";
import RecipePhoto from "./RecipePhoto";
import type { PhotoEntry } from "@/lib/model/photos";

/** A photo filling the screen, for reading a cookbook page while cooking. */
export default function PhotoViewer({
  uid,
  recipeId,
  photo,
  title,
  onClose,
}: {
  uid: string;
  recipeId: string;
  photo: PhotoEntry & { id: string };
  title: string;
  onClose: () => void;
}) {
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
        <RecipePhoto uid={uid} recipeId={recipeId} photo={photo} alt={title} className="max-h-full max-w-full !object-contain" />
      </div>
    </div>
  );
}
