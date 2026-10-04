"use client";

import { fitWithin, MAX_PHOTO_BYTES } from "@/lib/model/photos";

/**
 * Shrinks a picked photo on the phone before it's stored or uploaded: a 12 MP
 * camera photo becomes a ~300 KB JPEG that still reads fine on a screen.
 * iPhones hand the browser a JPEG even for HEIC photos.
 */

async function decode(file: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; done: () => void }> {
  try {
    // Applies the photo's rotation from its EXIF data.
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return { source: bitmap, width: bitmap.width, height: bitmap.height, done: () => bitmap.close() };
  } catch {
    // Older browsers: fall back to an <img>.
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, done: () => URL.revokeObjectURL(url) };
  }
}

export type ShrinkResult = { ok: true; blob: Blob } | { ok: false; error: string };

export async function shrinkPhoto(file: Blob): Promise<ShrinkResult> {
  if (file.type && !file.type.startsWith("image/")) return { ok: false, error: "That isn't a photo." };
  let decoded;
  try {
    decoded = await decode(file);
  } catch {
    return { ok: false, error: "Couldn't open that photo. Try a different one." };
  }
  const { width, height } = fitWithin(decoded.width, decoded.height);
  if (!width || !height) {
    decoded.done();
    return { ok: false, error: "Couldn't open that photo. Try a different one." };
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")?.drawImage(decoded.source, 0, 0, width, height);
  decoded.done();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
  if (!blob) return { ok: false, error: "Couldn't shrink that photo. Try a different one." };
  if (blob.size >= MAX_PHOTO_BYTES) return { ok: false, error: "That photo is too big, even shrunk." };
  return { ok: true, blob };
}
