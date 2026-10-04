import { describe, expect, it } from "vitest";
import { isOwnPhotoUrl, ReadPhotosRequest } from "@/lib/import/photos";

const own = (uid: string, file = "abc.jpg") =>
  `https://firebasestorage.googleapis.com/v0/b/recipe-box.firebasestorage.app/o/${encodeURIComponent(`users/${uid}/photos/${file}`)}?alt=media&token=t`;

describe("isOwnPhotoUrl", () => {
  it("accepts your own photo's download address", () => {
    expect(isOwnPhotoUrl(own("u1"), "u1")).toBe(true);
  });

  it.each([
    ["someone else's photo", own("u2"), "u1"],
    ["a different host", own("u1").replace("firebasestorage.googleapis.com", "example.com"), "u1"],
    ["plain http", own("u1").replace("https:", "http:"), "u1"],
    ["not a download", own("u1").replace("alt=media", "alt=json"), "u1"],
    ["outside the photos folder", own("u1").replace("photos", "secrets"), "u1"],
    ["a path trick", own("u1", "../../u2/photos/x.jpg"), "u1"],
    ["nonsense", "not a url", "u1"],
  ])("refuses %s", (_label, url, uid) => {
    expect(isOwnPhotoUrl(url, uid)).toBe(false);
  });
});

describe("ReadPhotosRequest", () => {
  const img = { mediaType: "image/jpeg" as const, data: "aGVsbG8=" };

  it("takes up to 4 photos in total", () => {
    expect(ReadPhotosRequest.safeParse({ images: [img, img], urls: [own("u")] }).success).toBe(true);
    expect(ReadPhotosRequest.safeParse({ images: [img, img, img], urls: [own("u"), own("u")] }).success).toBe(false);
  });

  it("needs at least one", () => {
    const r = ReadPhotosRequest.safeParse({});
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe("Add a photo first.");
  });

  it("refuses odd types and data", () => {
    expect(ReadPhotosRequest.safeParse({ images: [{ ...img, mediaType: "image/svg+xml" }] }).success).toBe(false);
    expect(ReadPhotosRequest.safeParse({ images: [{ ...img, data: "<script>" }] }).success).toBe(false);
  });
});
