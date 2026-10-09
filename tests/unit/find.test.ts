import { describe, expect, it } from "vitest";
import { findPrompt } from "@/lib/ai/prompts/find";
import { FindRequest, keepRealLinks, sameUrlKey } from "@/lib/import/find";

const idea = (url: string, title = "Sample stew", uses: string[] = ["chicken"]) => ({ title, url, uses, why: "Uses what you have." });

describe("find new recipes on the web", () => {
  it("treats small differences in an address as the same page", () => {
    expect(sameUrlKey("https://www.Example.com/recipes/stew/#comments")).toBe("example.com/recipes/stew");
    expect(sameUrlKey("http://localhost/x")).toBeNull();
  });

  it("only keeps links the search really returned", () => {
    const seen = ["https://example.com/recipes/stew/", "https://food.example.net/lemon-orzo?serves=4"];
    const ideas = keepRealLinks(
      {
        ideas: [
          idea("https://www.example.com/recipes/stew"),
          idea("https://made-up.example.org/fake", "Invented"),
          idea("https://food.example.net/lemon-orzo?serves=4", "Lemon orzo", ["Lemon", "basil"]),
          idea("https://example.com/recipes/stew#again", "Repeat"),
          idea("http://127.0.0.1/admin", "Sneaky"),
        ],
      },
      [...seen, "http://127.0.0.1/admin"],
      ["chicken", "lemon"]
    );
    expect(ideas.map((i) => i.title)).toEqual(["Sample stew", "Lemon orzo"]);
    expect(ideas[1]).toMatchObject({ site: "food.example.net", uses: ["lemon"] });
  });

  it("returns at most five", () => {
    const urls = Array.from({ length: 8 }, (_, i) => `https://example.com/r/${i}`);
    expect(keepRealLinks({ ideas: urls.map((u) => idea(u)) }, urls, ["chicken"])).toHaveLength(5);
  });

  it("needs at least one item and keeps requests small", () => {
    expect(FindRequest.safeParse({ have: [] }).success).toBe(false);
    expect(FindRequest.safeParse({ have: ["x".repeat(41)] }).success).toBe(false);
    expect(FindRequest.parse({ have: [" leeks "] })).toEqual({ have: ["leeks"], saved: [] });
  });

  it("asks for what you have and skips what you've saved", () => {
    const p = findPrompt({ have: ["leeks", "potatoes"], saved: ["Potato leek soup"] });
    expect(p).toContain("What they have: leeks, potatoes");
    expect(p).toContain("don't suggest these): Potato leek soup");
    expect(findPrompt({ have: ["leeks"], saved: [] })).not.toContain("already have");
  });
});
