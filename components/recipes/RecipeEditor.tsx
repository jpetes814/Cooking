"use client";

import { useState } from "react";
import Sheet from "@/components/ui/Sheet";
import { TextArea, TextInput } from "@/components/ui/fields";
import { useOnline } from "@/components/shell/useOnline";
import { callAi } from "@/lib/ai/client";
import { hasContent, mergeDraft, type ImportDraft, type ImportVia } from "@/lib/import/draft";
import { buildRecipe, parseLink, toInput, type Recipe, type RecipeDoc } from "@/lib/model/recipe";
import { MAX_PHOTOS, sortedPhotos } from "@/lib/model/photos";
import PhotoPicker, { type NewPhoto } from "./PhotoPicker";
import TagPicker from "./TagPicker";
import RecipePreview from "./RecipePreview";
import { reviewNotes } from "@/lib/model/review";
import { normalizeTags } from "@/lib/search/tags";
import { MAX_PHOTOS_TO_READ } from "@/lib/import/photos";

/** A shrunk photo as base64, for sending to Claude. */
function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export interface PhotoEdits {
  add: NewPhoto[];
  remove: string[];
}

type FillState =
  | { status: "idle" }
  | { status: "busy" }
  | { status: "done"; tone: "ok" | "warn"; text: string };

const FILLED_FROM: Record<ImportVia, string> = {
  page: "Filled in from the recipe page.",
  ai: "Claude read it and filled in a draft. Check the amounts and steps before saving.",
};

/**
 * Add or edit a recipe. Only the name is required, so a TikTok link and a
 * name is a complete recipe; the rest can be filled in later.
 */
export default function RecipeEditor({
  uid,
  existing,
  usedTags,
  onSave,
  onClose,
}: {
  uid: string;
  existing?: Recipe;
  /** Tags already on other recipes, offered first. */
  usedTags: string[];
  onSave: (recipe: RecipeDoc, photos: PhotoEdits) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState(() => toInput(existing));
  const [tags, setTags] = useState<string[]>(() => existing?.tags ?? []);
  const [added, setAdded] = useState<NewPhoto[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const kept = sortedPhotos(existing?.photos).filter((p) => !removed.includes(p.id));
  const [error, setError] = useState<string | null>(null);
  const [fill, setFill] = useState<FillState>({ status: "idle" });
  const [read, setRead] = useState<FillState>({ status: "idle" });
  const [suggested, setSuggested] = useState<string[]>([]);
  // Everything Claude offered, so the review can point out what came from it.
  const [claudeTags, setClaudeTags] = useState<string[]>([]);
  const [filledByClaude, setFilledByClaude] = useState(false);
  const [reviewing, setReviewing] = useState<RecipeDoc | null>(null);
  const online = useOnline();
  const set = (key: keyof typeof form) => (v: string) => {
    setForm((f) => ({ ...f, [key]: v }));
    setError(null);
    if (key === "url") setFill({ status: "idle" });
  };

  /**
   * Puts a draft into the empty fields and offers its tags. Merges into the
   * newest form, so anything typed while it loaded is kept; the message is
   * worked out from the form as it was when the button was tapped.
   */
  function applyDraft(draft: ImportDraft, via: ImportVia, setState: (s: FillState) => void) {
    if (!hasContent(draft)) {
      setState({ status: "done", tone: "warn", text: "Couldn't find a recipe there." });
      return;
    }
    setForm((current) => mergeDraft(current, draft).form);
    setSuggested(draft.suggestedTags.filter((t) => !tags.includes(t)));
    setClaudeTags((c) => [...new Set([...c, ...draft.suggestedTags])]);
    if (via === "ai") setFilledByClaude(true);
    const merged = mergeDraft(form, draft);
    setState(
      merged.filled.length
        ? { status: "done", tone: "ok", text: FILLED_FROM[via] }
        : { status: "done", tone: "warn", text: "Everything was already filled in, so nothing changed." }
    );
  }

  async function fillFromLink() {
    const link = parseLink(form.url);
    if (!link.ok) {
      setFill({ status: "done", tone: "warn", text: link.error });
      return;
    }
    setFill({ status: "busy" });
    const res = await callAi<{ draft: ImportDraft; via: ImportVia }>("/api/import", { url: link.url, usedTags });
    if (!res.ok) {
      setFill({ status: "done", tone: "warn", text: res.error });
      return;
    }
    applyDraft(res.data.draft, res.data.via, setFill);
  }

  /** Sends the recipe's photos to Claude: uploaded ones by address, new ones as the shrunk image. */
  async function readPhotos() {
    setRead({ status: "busy" });
    const urls = kept.map((p) => p.url).filter((u): u is string => Boolean(u)).slice(0, MAX_PHOTOS_TO_READ);
    const fresh = added.slice(0, MAX_PHOTOS_TO_READ - urls.length);
    let images: { mediaType: "image/jpeg"; data: string }[];
    try {
      images = await Promise.all(fresh.map(async (p) => ({ mediaType: "image/jpeg" as const, data: await toBase64(p.blob) })));
    } catch {
      setRead({ status: "done", tone: "warn", text: "Couldn't get those photos ready. Try again." });
      return;
    }
    if (!images.length && !urls.length) {
      setRead({ status: "done", tone: "warn", text: "These photos are still uploading. Try again in a moment." });
      return;
    }
    const res = await callAi<{ draft: ImportDraft; via: ImportVia }>("/api/read-photos", { images, urls, usedTags });
    if (!res.ok) {
      setRead({ status: "done", tone: "warn", text: res.error });
      return;
    }
    applyDraft(res.data.draft, res.data.via, setRead);
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    const built = buildRecipe(form, Date.now(), existing);
    if (!built.ok) {
      setError(built.error);
      return;
    }
    // Check it over first; saving happens from the review.
    setReviewing({ ...built.recipe, tags: normalizeTags(tags) });
  }

  if (reviewing) {
    return (
      // A fresh sheet, so the review starts at the top with the notes and photos.
      <Sheet key="review" title={existing ? "Edit recipe" : "New recipe"} onClose={onClose}>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Check it over</h3>
        <RecipePreview
          uid={uid}
          recipeId={existing?.id ?? null}
          recipe={reviewing}
          kept={kept}
          added={added}
          notes={reviewNotes(reviewing, { filledByClaude, claudeTags })}
          claudeTags={claudeTags}
        />
        <div className="pb-safe sticky bottom-0 mt-5 flex gap-2 bg-surface py-3">
          <button
            type="button"
            onClick={() => setReviewing(null)}
            className="min-h-12 flex-1 rounded-xl border border-border font-medium"
          >
            Back to edit
          </button>
          <button
            type="button"
            onClick={() => onSave(reviewing, { add: added, remove: removed })}
            className="min-h-12 flex-1 rounded-xl bg-accent font-semibold text-on-accent"
          >
            Looks good, save
          </button>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet title={existing ? "Edit recipe" : "New recipe"} onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <TextInput label="Name" value={form.title} onChange={set("title")} placeholder="Creamy tomato soup" />
        <TextInput
          label="Link"
          hint="TikTok, Instagram, YouTube, or any recipe page. Optional."
          value={form.url}
          onChange={set("url")}
          placeholder="Paste a link"
          inputMode="url"
        />
        {form.url.trim() && (
          <div>
            <button
              type="button"
              onClick={fillFromLink}
              disabled={!online || fill.status === "busy"}
              className="min-h-11 w-full rounded-xl border border-accent bg-accent-soft font-semibold text-accent disabled:opacity-60"
            >
              {!online ? "Fill from link needs signal" : fill.status === "busy" ? "Reading the link..." : "Fill from link"}
            </button>
            {fill.status === "done" && (
              <p role="status" className={`mt-2 text-sm ${fill.tone === "ok" ? "text-ok" : "text-warn"}`}>
                {fill.text}
              </p>
            )}
          </div>
        )}
        <PhotoPicker
          uid={uid}
          recipeId={existing?.id ?? null}
          existing={kept}
          added={added}
          room={MAX_PHOTOS - kept.length - added.length}
          onAdd={(photos) => setAdded((a) => [...a, ...photos])}
          onRemoveExisting={(id) => setRemoved((r) => [...r, id])}
          onRemoveAdded={(id) => setAdded((a) => a.filter((p) => p.id !== id))}
        />
        {kept.length + added.length > 0 && (
          <div>
            <button
              type="button"
              onClick={readPhotos}
              disabled={!online || read.status === "busy"}
              className="min-h-11 w-full rounded-xl border border-accent bg-accent-soft font-semibold text-accent disabled:opacity-60"
            >
              {!online
                ? "Reading photos needs signal"
                : read.status === "busy"
                  ? "Reading the photos..."
                  : kept.length + added.length === 1
                    ? "Read photo with Claude"
                    : "Read photos with Claude"}
            </button>
            {read.status === "done" ? (
              <p role="status" className={`mt-2 text-sm ${read.tone === "ok" ? "text-ok" : "text-warn"}`}>
                {read.text}
              </p>
            ) : (
              <p className="mt-1 text-xs text-muted">
                For a cookbook page, recipe card, or caption screenshot. Fills the empty fields
                {kept.length + added.length > MAX_PHOTOS_TO_READ ? `, using the first ${MAX_PHOTOS_TO_READ} photos` : ""}.
              </p>
            )}
          </div>
        )}
        <TagPicker
          tags={tags}
          used={usedTags}
          suggested={suggested.filter((t) => !tags.includes(t))}
          onChange={setTags}
        />
        <TextInput label="Servings" value={form.servings} onChange={set("servings")} inputMode="decimal" placeholder="4" />
        <TextArea
          label="Ingredients"
          hint="One per line, like 2 cups diced onion."
          value={form.ingredients}
          onChange={set("ingredients")}
          rows={6}
        />
        <TextArea label="Steps" hint="One per line." value={form.steps} onChange={set("steps")} rows={6} />
        <TextArea label="Notes" value={form.notes} onChange={set("notes")} placeholder="Swaps, tips, who loved it..." />

        {error && (
          <p role="alert" className="text-sm text-warn">
            {error}
          </p>
        )}
        <button type="submit" className="min-h-12 w-full rounded-xl bg-accent font-semibold text-on-accent">
          {existing ? "Review changes" : "Review recipe"}
        </button>
      </form>
    </Sheet>
  );
}
