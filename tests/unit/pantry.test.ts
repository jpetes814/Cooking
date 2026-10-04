import { describe, expect, it } from "vitest";
import {
  checkNewStaple,
  MAX_STAPLES,
  normalizeStaple,
  sortStaples,
  STARTER_STAPLES,
  suggestStaples,
} from "@/lib/model/pantry";

describe("normalizeStaple", () => {
  it("tidies spacing and capitals", () => {
    expect(normalizeStaple("  Olive   OIL ")).toBe("olive oil");
  });

  it("rejects empty and overly long entries", () => {
    expect(normalizeStaple("   ")).toBeNull();
    expect(normalizeStaple("x".repeat(61))).toBeNull();
  });
});

describe("checkNewStaple", () => {
  it("accepts a new staple, tidied", () => {
    expect(checkNewStaple(["salt"], " Cumin ")).toEqual({ ok: true, item: "cumin" });
  });

  it("explains what's wrong", () => {
    expect(checkNewStaple([], "  ")).toEqual({ ok: false, error: "Type something first." });
    expect(checkNewStaple(["salt"], "SALT")).toEqual({ ok: false, error: "salt is already in your pantry." });
    const full = Array.from({ length: MAX_STAPLES }, (_, i) => `item ${i}`);
    expect(checkNewStaple(full, "cumin").ok).toBe(false);
  });
});

describe("suggestStaples", () => {
  it("leaves out what you already have", () => {
    const s = suggestStaples(["salt", "butter"]);
    expect(s).not.toContain("salt");
    expect(s).not.toContain("butter");
    expect(s).toHaveLength(STARTER_STAPLES.length - 2);
  });
});

describe("sortStaples", () => {
  it("sorts without changing the original", () => {
    const items = ["sugar", "butter", "rice"];
    expect(sortStaples(items)).toEqual(["butter", "rice", "sugar"]);
    expect(items[0]).toBe("sugar");
  });
});
