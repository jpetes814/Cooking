import { describe, expect, it } from "vitest";
import { applyPhotoEdits, coverPhoto, fitWithin, MAX_PHOTOS, photoPath, roomFor, sortedPhotos } from "@/lib/model/photos";

describe("fitWithin", () => {
  it("shrinks the longest side to the limit, keeping the shape", () => {
    expect(fitWithin(4032, 3024)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3024, 4032)).toEqual({ width: 1200, height: 1600 });
  });

  it("never scales small photos up", () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it("handles nonsense sizes", () => {
    expect(fitWithin(0, 100)).toEqual({ width: 0, height: 0 });
  });
});

describe("photo maps", () => {
  const map = {
    b: { path: photoPath("u", "b"), url: null, addedAt: 2 },
    a: { path: photoPath("u", "a"), url: "https://x/a", addedAt: 1 },
  };

  it("sorts oldest first and picks the cover", () => {
    expect(sortedPhotos(map).map((p) => p.id)).toEqual(["a", "b"]);
    expect(coverPhoto(map)?.id).toBe("a");
    expect(coverPhoto(undefined)).toBeNull();
    expect(photoPath("u", "b")).toBe("users/u/photos/b.jpg");
  });

  it("adds and removes, never past the limit", () => {
    const next = applyPhotoEdits(map, { add: [{ id: "c", path: "p/c" }], remove: ["a"] }, 10);
    expect(Object.keys(next).sort()).toEqual(["b", "c"]);
    expect(next.c).toEqual({ path: "p/c", url: null, addedAt: 10 });

    const many = Array.from({ length: 12 }, (_, i) => ({ id: `n${i}`, path: `p/${i}` }));
    expect(Object.keys(applyPhotoEdits(undefined, { add: many, remove: [] }, 0))).toHaveLength(MAX_PHOTOS);
    expect(roomFor(map)).toBe(MAX_PHOTOS - 2);
  });
});
