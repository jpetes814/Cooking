import { z } from "zod";
import { MAX_TAG_LENGTH } from "@/lib/search/tags";

/**
 * "Read photos": what the phone may send. Photos are already shrunk on the
 * phone, so a handful fit well inside a request. Uploaded photos are sent by
 * address instead, and only the signed-in person's own photos are accepted.
 */

export const MAX_PHOTOS_TO_READ = 4;
/** About 1 MB of image per photo once decoded. Shrunk photos are far smaller. */
const MAX_BASE64 = 1_400_000;

export const ReadPhotosRequest = z
  .object({
    images: z
      .array(
        z.object({
          mediaType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
          data: z.string().min(1).max(MAX_BASE64).regex(/^[A-Za-z0-9+/=]+$/),
        })
      )
      .max(MAX_PHOTOS_TO_READ)
      .default([]),
    urls: z.array(z.string().max(2000)).max(MAX_PHOTOS_TO_READ).default([]),
    usedTags: z.array(z.string().max(MAX_TAG_LENGTH)).max(100).default([]),
  })
  .refine((b) => b.images.length + b.urls.length >= 1, { message: "Add a photo first." })
  .refine((b) => b.images.length + b.urls.length <= MAX_PHOTOS_TO_READ, {
    message: `Claude can read up to ${MAX_PHOTOS_TO_READ} photos at a time.`,
  });

export type ReadPhotosBody = z.infer<typeof ReadPhotosRequest>;

/**
 * True for a Firebase Storage download address of one of this person's own
 * recipe photos: https://firebasestorage.googleapis.com/v0/b/<bucket>/o/users%2F<uid>%2Fphotos%2F...
 */
export function isOwnPhotoUrl(raw: string, uid: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.hostname !== "firebasestorage.googleapis.com" || url.port) return false;
  const m = url.pathname.match(/^\/v0\/b\/[^/]+\/o\/([^/]+)$/);
  if (!m || url.searchParams.get("alt") !== "media") return false;
  let path: string;
  try {
    path = decodeURIComponent(m[1]);
  } catch {
    return false;
  }
  return path.startsWith(`users/${uid}/photos/`) && !path.includes("..");
}
