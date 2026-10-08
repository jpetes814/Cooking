"use client";

import { usePhotoSrc } from "./RecipePhoto";
import ImageViewer from "./ImageViewer";
import type { PhotoEntry } from "@/lib/model/photos";

/** A saved recipe photo filling the screen, for reading a cookbook page while cooking. */
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
  const src = usePhotoSrc(uid, recipeId, photo);
  return <ImageViewer src={src} alt={title} onClose={onClose} />;
}
