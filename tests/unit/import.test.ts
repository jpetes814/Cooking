import { describe, expect, it } from "vitest";
import { cleanText, metaDescription, pageText, parseInstructions, parseYield, recipeFromHtml } from "@/lib/import/html";
import { publicHttpUrl } from "@/lib/import/safe-url";
import { hasContent, mergeDraft, type ImportDraft } from "@/lib/import/draft";
import { importRecipe, tidyExtracted, type Extract } from "@/lib/import/run";
import { youtubeId, type Sources } from "@/lib/import/sources";
import { mockExtract } from "@/lib/ai/mocks";

const ld = (obj: unknown) => `<html><head><script type="application/ld+json">${JSON.stringify(obj)}</script></head></html>`;

describe("recipeFromHtml", () => {
  it("reads a Recipe inside @graph", () => {
    const html = ld({
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "WebPage", name: "Page" },
        {
          "@type": ["Recipe", "NewsArticle"],
          name: "Pumpkin &amp; sage soup",
          recipeYield: "Serves 6",
          recipeIngredient: ["1 small pumpkin", "<b>6</b> sage leaves"],
          recipeInstructions: [{ "@type": "HowToStep", text: "Roast the pumpkin." }, "Blend with stock."],
        },
      ],
    });
    expect(recipeFromHtml(html)).toEqual({
      title: "Pumpkin & sage soup",
      servings: 6,
      ingredients: ["1 small pumpkin", "6 sage leaves"],
      steps: ["Roast the pumpkin.", "Blend with stock."],
      notes: "",
    });
  });

  it("finds it in a top-level array and skips broken blocks", () => {
    const html = `<script type="application/ld+json">{ not json</script>${ld([{ "@type": "Recipe", name: "Toast", recipeIngredient: ["bread"] }])}`;
    expect(recipeFromHtml(html)?.title).toBe("Toast");
  });

  it("returns null when there's no recipe markup", () => {
    expect(recipeFromHtml("<html><body>Just a story</body></html>")).toBeNull();
    expect(recipeFromHtml(ld({ "@type": "Article", name: "News" }))).toBeNull();
  });
});

describe("page pieces", () => {
  it("parses yields in their many shapes", () => {
    expect(parseYield(4)).toBe(4);
    expect(parseYield("4-6 servings")).toBe(4);
    expect(parseYield(["", "Makes 12 cookies"])).toBe(12);
    expect(parseYield("a crowd")).toBeNull();
  });

  it("flattens sections and splits string instructions into lines", () => {
    expect(
      parseInstructions([
        { "@type": "HowToSection", itemListElement: [{ text: "One" }, { text: "Two" }] },
        { "@type": "HowToStep", name: "Three" },
      ])
    ).toEqual(["One", "Two", "Three"]);
    expect(parseInstructions("Mix.<br>Bake.")).toEqual(["Mix.", "Bake."]);
  });

  it("cleans tags and entities", () => {
    expect(cleanText("<p>Heat to 350&deg;F &amp; wait&#8230;</p>")).toBe("Heat to 350°F & wait…");
  });

  it("pulls readable text and descriptions, skipping scripts", () => {
    const html = `<title>Soup</title><meta property="og:description" content="Cozy soup &amp; bread"><script>var x=1</script><p>Chop it.</p>`;
    expect(pageText(html)).toBe("Soup\nChop it.");
    expect(metaDescription(html)).toBe("Cozy soup & bread");
  });
});

describe("publicHttpUrl", () => {
  it("allows ordinary public links", () => {
    expect(publicHttpUrl("https://www.example.com/recipes/soup")).not.toBeNull();
    expect(publicHttpUrl("http://example.org:80/x")).not.toBeNull();
  });

  it.each([
    "http://localhost:3000/",
    "http://127.0.0.1/",
    "http://169.254.169.254/latest/meta-data",
    "http://[::1]/",
    "http://10.0.0.5/",
    "http://router.local/",
    "http://metadata.google.internal/",
    "https://example.com:8443/",
    "https://user:pass@example.com/",
    "ftp://example.com/file",
    "file:///etc/passwd",
    "http://127-0-0-1.example.io/",
    "not a url",
  ])("blocks %s", (url) => {
    expect(publicHttpUrl(url)).toBeNull();
  });
});

describe("youtubeId", () => {
  it("reads common link shapes", () => {
    expect(youtubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10")).toBe("dQw4w9WgXcQ");
    expect(youtubeId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeId("https://www.youtube.com/")).toBeNull();
  });
});

describe("mergeDraft", () => {
  const draft: ImportDraft = { title: "Soup", servings: 4, ingredients: ["1 onion", "2 cups stock"], steps: ["Simmer"], notes: "" };
  const blank = { title: "", url: "https://x.com/a", servings: "", ingredients: "", steps: "", notes: "" };

  it("fills only empty fields and says which", () => {
    const { form, filled } = mergeDraft({ ...blank, title: "My soup" }, draft);
    expect(form).toEqual({ ...blank, title: "My soup", servings: "4", ingredients: "1 onion\n2 cups stock", steps: "Simmer" });
    expect(filled).toEqual(["servings", "ingredients", "steps"]);
  });

  it("knows when a draft is empty", () => {
    expect(hasContent({ ...draft, title: "", ingredients: [], steps: [] })).toBe(false);
    expect(hasContent(draft)).toBe(true);
  });
});

describe("tidyExtracted", () => {
  it("trims, drops blanks, flattens newlines, and caps sizes", () => {
    const out = tidyExtracted({
      found: true,
      title: "  Soup  ",
      servings: 0,
      ingredients: ["  1 onion ", "", "2 cups\nstock"],
      steps: Array.from({ length: 70 }, (_, i) => `Step ${i}`),
      notes: "",
    });
    expect(out.title).toBe("Soup");
    expect(out.servings).toBeNull();
    expect(out.ingredients).toEqual(["1 onion", "2 cups stock"]);
    expect(out.steps).toHaveLength(60);
  });
});

describe("importRecipe", () => {
  const page: ImportDraft = { title: "Toast", servings: 1, ingredients: ["bread"], steps: ["Toast it"], notes: "" };
  const calls: string[] = [];
  const sources = (over: Partial<Sources> = {}): Sources => ({
    page: async () => ({ ok: true, recipe: page, text: "" }),
    tiktok: async () => ({ ok: true, caption: "garlic noodles: 2 cloves garlic...", author: "c" }),
    youtube: async () => ({ ok: true, title: "Garlic bread", description: "" }),
    ...over,
  });
  const extract: Extract = async (kind, text) => {
    calls.push(kind);
    return { ok: true, data: mockExtract(text), usage: { model: "m", inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 } };
  };

  it("reads recipe pages exactly, with no AI", async () => {
    calls.length = 0;
    const r = await importRecipe("https://example.com/toast", { sources: sources(), extract });
    expect(r).toEqual({ ok: true, draft: page, via: "page" });
    expect(calls).toEqual([]);
  });

  it("sends pages without markup to Claude", async () => {
    const r = await importRecipe("example.com/blog", {
      sources: sources({ page: async () => ({ ok: true, recipe: null, text: "x".repeat(100) + " garlic" }) }),
      extract,
    });
    expect(r).toMatchObject({ ok: true, via: "ai", draft: { title: "Lemon garlic pasta" } });
  });

  it("reads TikTok captions with Claude", async () => {
    calls.length = 0;
    const r = await importRecipe("https://www.tiktok.com/@c/video/1", { sources: sources(), extract });
    expect(r.ok).toBe(true);
    expect(calls).toEqual(["TikTok video caption"]);
  });

  it("explains captions with no recipe", async () => {
    const r = await importRecipe("https://www.tiktok.com/@c/video/1", {
      sources: sources({ tiktok: async () => ({ ok: true, caption: "dinner tonight #foodtok", author: "c" }) }),
      extract,
    });
    expect(r).toMatchObject({ ok: false, status: 422 });
  });

  it("says Instagram can't be read, without calling anything", async () => {
    calls.length = 0;
    const r = await importRecipe("https://www.instagram.com/reel/abc/", { sources: sources(), extract });
    expect(r).toMatchObject({ ok: false, status: 422 });
    expect(calls).toEqual([]);
  });

  it("passes on Claude and network errors", async () => {
    const failing: Extract = async () => ({ ok: false, status: 503, error: "The AI isn't set up" });
    expect(await importRecipe("https://www.tiktok.com/@c/video/1", { sources: sources(), extract: failing })).toEqual({
      ok: false,
      status: 503,
      error: "The AI isn't set up",
    });
    const down = sources({ page: async () => ({ ok: false, error: "Couldn't reach that site." }) });
    expect(await importRecipe("https://example.com/x", { sources: down, extract })).toMatchObject({ ok: false, status: 502 });
    expect(await importRecipe("not a link", { sources: sources(), extract })).toMatchObject({ ok: false, status: 400 });
  });
});
