import { parseLink, MAX_INGREDIENTS, MAX_STEPS, MAX_LINE, MAX_TITLE, MAX_NOTES } from "@/lib/model/recipe";
import type { ExtractedRecipe } from "@/lib/ai/prompts/import";
import type { AiResult } from "@/lib/ai/claude";
import type { ImportDraft, ImportVia } from "./draft";
import type { Sources } from "./sources";

/**
 * "Fill from link": decide how to read a link, read it, and hand back a draft.
 * Recipe pages with schema.org markup are read exactly. Captions and plain
 * pages go to Claude. Network and Claude are passed in, so this is testable.
 */

export type Extract = (kind: string, text: string) => Promise<AiResult<ExtractedRecipe>>;
export type ImportResult = { ok: true; draft: ImportDraft; via: ImportVia } | { ok: false; status: number; error: string };

const NO_RECIPE_IN_CAPTION =
  "That caption doesn't have the recipe in it. Creators often put it in a comment or on screen, so type it in for now.";

/** Keeps whatever Claude sends inside the limits the app and rules expect. */
export function tidyExtracted(r: ExtractedRecipe): ImportDraft {
  const clip = (s: string, n: number) => s.trim().slice(0, n);
  const lines = (list: string[], max: number) =>
    list.map((s) => clip(s.replace(/\s*\n\s*/g, " "), MAX_LINE)).filter(Boolean).slice(0, max);
  const servings = r.servings !== null && r.servings > 0 && r.servings <= 100 ? r.servings : null;
  return {
    title: clip(r.title, MAX_TITLE),
    servings,
    ingredients: lines(r.ingredients, MAX_INGREDIENTS),
    steps: lines(r.steps, MAX_STEPS),
    notes: clip(r.notes, MAX_NOTES),
  };
}

async function viaClaude(extract: Extract, kind: string, text: string, emptyMessage: string): Promise<ImportResult> {
  const res = await extract(kind, text);
  if (!res.ok) return res;
  const draft = tidyExtracted(res.data);
  if (!res.data.found || (draft.ingredients.length === 0 && draft.steps.length === 0)) {
    return { ok: false, status: 422, error: emptyMessage };
  }
  return { ok: true, draft, via: "ai" };
}

export async function importRecipe(raw: string, deps: { sources: Sources; extract: Extract }): Promise<ImportResult> {
  const link = parseLink(raw);
  if (!link.ok) return { ok: false, status: 400, error: link.error };
  const { sources, extract } = deps;

  switch (link.site) {
    case "instagram":
      return {
        ok: false,
        status: 422,
        error: "Instagram doesn't share captions with apps. Screenshot the caption for now; reading photos is coming soon.",
      };

    case "tiktok": {
      const tt = await sources.tiktok(link.url);
      if (!tt.ok) return { ok: false, status: 502, error: tt.error };
      if (!tt.caption.trim()) return { ok: false, status: 422, error: NO_RECIPE_IN_CAPTION };
      return viaClaude(extract, "TikTok video caption", tt.caption, NO_RECIPE_IN_CAPTION);
    }

    case "youtube": {
      const yt = await sources.youtube(link.url);
      if (!yt.ok) return { ok: false, status: 502, error: yt.error };
      const text = `Title: ${yt.title}\n\nDescription:\n${yt.description || "(none available)"}`;
      return viaClaude(
        extract,
        "YouTube video title and description",
        text,
        "That video's description doesn't have the recipe in it. Type it in for now."
      );
    }

    default: {
      const page = await sources.page(link.url);
      if (!page.ok) return { ok: false, status: 502, error: page.error };
      if (page.recipe) return { ok: true, draft: page.recipe, via: "page" };
      if (page.text.length < 80) {
        return { ok: false, status: 422, error: "Couldn't find a recipe on that page." };
      }
      return viaClaude(extract, "recipe web page text", page.text, "Couldn't find a recipe on that page.");
    }
  }
}
