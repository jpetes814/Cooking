import { describe, expect, it } from "vitest";
import { linkInText, sharedLink, withoutShare } from "@/lib/import/share";

describe("sending a link to the app", () => {
  it("finds the link in a shared caption", () => {
    expect(linkInText("Best pasta ever 🍋 https://www.instagram.com/reel/abc123/?igsh=xyz")).toBe(
      "https://www.instagram.com/reel/abc123/?igsh=xyz"
    );
    expect(linkInText("Try this (https://example.com/recipes/stew).")).toBe("https://example.com/recipes/stew");
    expect(linkInText("  https://vm.tiktok.com/ZM123/ ")).toBe("https://vm.tiktok.com/ZM123/");
  });

  it("takes a bare address, but not plain words", () => {
    expect(linkInText("example.com/soup")).toBe("https://example.com/soup");
    expect(linkInText("just some words")).toBeNull();
    expect(linkInText("")).toBeNull();
    expect(linkInText(null)).toBeNull();
    expect(linkInText("javascript:alert(1)")).toBeNull();
  });

  it("reads the Shortcut's ?add= and the share menu's ?url= or ?text=", () => {
    expect(sharedLink("?add=https%3A%2F%2Fexample.com%2Fa")).toBe("https://example.com/a");
    expect(sharedLink("?title=Soup&text=Look%20https%3A%2F%2Fexample.com%2Fb")).toBe("https://example.com/b");
    expect(sharedLink("?url=https%3A%2F%2Fexample.com%2Fc&text=hi")).toBe("https://example.com/c");
    expect(sharedLink("?tab=shop")).toBeNull();
  });

  it("clears the share bits from the address and keeps the rest", () => {
    expect(withoutShare("https://app.example/?add=x&tab=shop#top")).toBe("/?tab=shop#top");
    expect(withoutShare("https://app.example/?text=hi&title=t")).toBe("/");
  });
});
