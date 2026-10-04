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
import { normalizeTags } from "@/lib/search/tags";

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
  const online = useOnline();
  const set = (key: keyof typeof form) => (v: string) => {
    setForm((f) => ({ ...f, [key]: v }));
    setError(null);
    if (key === "url") setFill({ status: "idle" });
  };

  async function fillFromLink() {
    const link = parseLink(form.url);
    if (!link.ok) {
      setFill({ status: "done", tone: "warn", text: link.error });
      return;
    }
    setFill({ status: "busy" });
    const res = await callAi<{ draft: ImportDraft; via: ImportVia }>("/api/import", { url: link.url });
    if (!res.ok) {
      setFill({ status: "done", tone: "warn", text: res.error });
      return;
    }
    if (!hasContent(res.data.draft)) {
      setFill({ status: "done", tone: "warn", text: "Couldn't find a recipe there." });
      return;
    }
    // Merge into the newest form, so anything typed while it loaded is kept.
    // The message is worked out from the form as it was when the button was tapped.
    const draft = res.data.draft;
    setForm((current) => mergeDraft(current, draft).form);
    const merged = mergeDraft(form, draft);
    setFill(
      merged.filled.length
        ? { status: "done", tone: "ok", text: FILLED_FROM[res.data.via] }
        : { status: "done", tone: "warn", text: "Everything was already filled in, so nothing changed." }
    );
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    const built = buildRecipe(form, Date.now(), existing);
    if (!built.ok) {
      setError(built.error);
      return;
    }
    onSave({ ...built.recipe, tags: normalizeTags(tags) }, { add: added, remove: removed });
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
        <TagPicker tags={tags} used={usedTags} onChange={setTags} />
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
          {existing ? "Save changes" : "Save recipe"}
        </button>
      </form>
    </Sheet>
  );
}
