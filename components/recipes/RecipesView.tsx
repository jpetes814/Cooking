"use client";

import { useEffect, useMemo, useState } from "react";
import { createRecipe, deleteRecipe, logCooked, rateRecipe, saveNextTime, unlogCooked, updateRecipe } from "@/lib/data/recipes";
import { daysAgo, isFavorite, lastCooked, SORT_LABEL, sortBy, type SortMode } from "@/lib/model/cooking";
import { useNow } from "@/components/shell/useNow";
import { queueDeletes, queueUploads } from "@/lib/data/photos";
import { parseLink, SITE_LABEL, type Recipe, type RecipeDoc } from "@/lib/model/recipe";
import { applyPhotoEdits, coverPhoto, photoPath, sortedPhotos } from "@/lib/model/photos";
import IdeasCard from "./IdeasCard";
import WhatCanIMake from "./WhatCanIMake";
import RecipeDetail from "./RecipeDetail";
import { linkInText, sharedLink, withoutShare } from "@/lib/import/share";
import RecipeEditor, { type PhotoEdits } from "./RecipeEditor";
import RecipePhoto from "./RecipePhoto";
import { TagLabel } from "./TagPicker";
import { filterRecipes } from "@/lib/search/recipes";
import { currentSeason, tagCounts, tagLeaf } from "@/lib/search/tags";

type Editing =
  | { mode: "new"; start?: { title: string; url: string }; autoFill?: boolean }
  | { mode: "edit"; recipe: Recipe }
  | null;

/** A link sent to the app in its address (an iPhone Shortcut or a share menu). */
function readSharedLink(): string | null {
  return typeof window === "undefined" ? null : sharedLink(window.location.search);
}

/** The Recipes tab: your list, one recipe at a time, and the editor. */
export default function RecipesView({ uid, recipes, staples }: { uid: string; recipes: Recipe[]; staples: string[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [making, setMaking] = useState(false);
  const [editing, setEditing] = useState<Editing>(() => {
    const link = readSharedLink();
    return link ? { mode: "new", start: { title: "", url: link }, autoFill: true } : null;
  });
  const [pasteNote, setPasteNote] = useState<string | null>(null);
  // Once read, clear it from the address so a reload doesn't start it again.
  useEffect(() => {
    if (readSharedLink()) window.history.replaceState(null, "", withoutShare(window.location.href));
  }, []);

  /** Reads a copied link and starts a recipe from it. iPhone asks once to allow pasting. */
  async function pasteLink() {
    setPasteNote(null);
    let text = "";
    try {
      text = await navigator.clipboard.readText();
    } catch {
      setPasteNote("Couldn't read what you copied. Tap + Add recipe and paste the link into Link instead.");
      return;
    }
    const link = linkInText(text);
    if (!link) {
      setPasteNote("Copy a link first: in Instagram or TikTok, tap Share, then Copy link.");
      return;
    }
    setOpenId(null);
    setEditing({ mode: "new", start: { title: "", url: link }, autoFill: true });
  }
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const open = recipes.find((r) => r.id === openId) ?? null;

  const counts = useMemo(() => tagCounts(recipes), [recipes]);
  const usedTags = useMemo(() => counts.map((c) => c.tag).filter((t) => recipes.some((r) => r.tags.includes(t))), [counts, recipes]);
  const [sort, setSort] = useState<SortMode>("newest");
  const [favorites, setFavorites] = useState(false);
  const now = useNow();
  const shown = useMemo(() => {
    const matched = filterRecipes(recipes, { query, tags: picked });
    return sortBy(favorites ? matched.filter(isFavorite) : matched, sort);
  }, [recipes, query, picked, favorites, sort]);
  const filtering = query.trim() !== "" || picked.length > 0 || favorites;
  const seasonTag = `season/${currentSeason(new Date())}`;
  // Filter chips: what's in season first, then your most used tags and groups.
  const chips = [seasonTag, ...counts.map((c) => c.tag).filter((t) => t !== seasonTag)].slice(0, 16);
  const toggle = (tag: string) => setPicked((p) => (p.includes(tag) ? p.filter((t) => t !== tag) : [...p, tag]));

  /** Saves the recipe, then hands new photos to the upload queue and old ones to the delete queue. */
  function save(doc: RecipeDoc, edits: PhotoEdits) {
    const existing = editing?.mode === "edit" ? editing.recipe : null;
    const adds = edits.add.map((p) => ({ ...p, path: photoPath(uid, p.id) }));
    const withPhotos = { ...doc, photos: applyPhotoEdits(existing?.photos, { add: adds, remove: edits.remove }, Date.now()) };
    const id = existing ? existing.id : createRecipe(uid, withPhotos);
    if (existing) updateRecipe(uid, id, withPhotos);
    else setOpenId(id);
    // Only photos that made it into the recipe (it holds at most 10).
    const saved = adds.filter((p) => withPhotos.photos[p.id]);
    if (saved.length) void queueUploads(uid, id, saved);
    const gone = sortedPhotos(existing?.photos).filter((p) => edits.remove.includes(p.id));
    if (gone.length) void queueDeletes(uid, gone);
    setEditing(null);
  }

  // Shown even with an empty box: searching the web still helps.
  const makeButton = (
    <button
      type="button"
      onClick={() => setMaking(true)}
      className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-accent bg-accent-soft font-semibold text-accent"
    >
      <span aria-hidden>🥕</span> What can I make?
    </button>
  );

  const editor = editing && (
    <RecipeEditor
      uid={uid}
      existing={editing.mode === "edit" ? editing.recipe : undefined}
      start={editing.mode === "new" ? editing.start : undefined}
      autoFill={editing.mode === "new" && editing.autoFill}
      usedTags={usedTags}
      onClose={() => setEditing(null)}
      onSave={save}
    />
  );

  if (open) {
    return (
      <>
        <RecipeDetail
          key={open.id}
          uid={uid}
          recipe={open}
          onBack={() => setOpenId(null)}
          onRate={(rating) => rateRecipe(uid, open.id, rating)}
          onCooked={(at) => logCooked(uid, open.id, at)}
          onUndoCooked={(at) => unlogCooked(uid, open.id, at)}
          onNextTime={(text) => saveNextTime(uid, open.id, text)}
          onTag={(tag) => {
            setQuery("");
            setPicked([tag]);
            setOpenId(null);
          }}
          onEdit={() => setEditing({ mode: "edit", recipe: open })}
          onDelete={() => {
            deleteRecipe(uid, open.id);
            const photos = sortedPhotos(open.photos);
            if (photos.length) void queueDeletes(uid, photos);
            setOpenId(null);
          }}
        />
        {editor}
      </>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="whitespace-nowrap text-lg font-semibold">
          Your recipes{recipes.length > 0 && <span className="font-normal text-muted"> · {recipes.length}</span>}
        </h2>
        <div className="ml-auto flex shrink-0 gap-2">
          <button
            type="button"
            onClick={pasteLink}
            className="min-h-11 rounded-xl border border-accent bg-accent-soft px-3 font-semibold text-accent"
          >
            Paste link
          </button>
          <button
            type="button"
            onClick={() => setEditing({ mode: "new" })}
            className="min-h-11 rounded-xl bg-accent px-4 font-semibold text-on-accent"
          >
            + Add recipe
          </button>
        </div>
      </div>
      {pasteNote && (
        <p role="status" className="text-sm text-warn">
          {pasteNote}
        </p>
      )}

      {recipes.length === 0 && makeButton}
      {recipes.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm leading-relaxed text-muted">
          No recipes yet. Copy a TikTok, Instagram, or YouTube link and tap{" "}
          <span className="font-medium text-text">Paste link</span>, or tap <span className="font-medium text-text">Add recipe</span> to type
          one in or add a photo of a cookbook page.
        </p>
      ) : (
        <>
          {!filtering && recipes.length >= 3 && <IdeasCard uid={uid} recipes={recipes} now={now} onOpen={setOpenId} />}
          {!filtering && makeButton}
          <div className="space-y-2">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search: soup, chicken lemon, thai..."
              aria-label="Search recipes"
              autoCapitalize="none"
              className="block min-h-12 w-full rounded-xl border border-border bg-surface px-3 text-base outline-none focus:border-accent"
            />
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Filter by tag">
              <button
                type="button"
                aria-pressed={favorites}
                onClick={() => setFavorites((f) => !f)}
                className={`min-h-10 shrink-0 rounded-full border px-3 text-sm ${
                  favorites ? "border-accent bg-accent-soft font-semibold text-accent" : "border-border bg-surface"
                }`}
              >
                ★ Favorites
              </button>
              {chips.map((t) => {
                const on = picked.includes(t);
                const label = t === seasonTag ? `In season: ${tagLeaf(t)}` : null;
                return (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(t)}
                    className={`min-h-10 shrink-0 rounded-full border px-3 text-sm ${
                      on ? "border-accent bg-accent-soft font-semibold text-accent" : "border-border bg-surface"
                    }`}
                  >
                    {label ?? <TagLabel tag={t} />}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-between gap-2 text-sm text-muted">
              <span>
                {filtering
                  ? `${shown.length} of ${recipes.length} recipes`
                  : `${recipes.length} recipe${recipes.length === 1 ? "" : "s"}`}
                {filtering && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      setPicked([]);
                      setFavorites(false);
                    }}
                    className="ml-1 min-h-10 px-2 font-medium text-accent"
                  >
                    Clear
                  </button>
                )}
              </span>
              <label className="flex items-center gap-1">
                <span>Sort</span>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortMode)}
                  aria-label="Sort recipes"
                  className="min-h-10 rounded-lg border border-border bg-surface px-2 text-sm text-text"
                >
                  {(Object.keys(SORT_LABEL) as SortMode[]).map((m) => (
                    <option key={m} value={m}>
                      {SORT_LABEL[m]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {shown.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted">
              Nothing matches. Try fewer words or tags.
            </p>
          ) : (
            <ul aria-label="Your recipes" className="space-y-2">
              {shown.map((r) => {
                const link = r.source.url ? parseLink(r.source.url) : null;
                const photoCount = Object.keys(r.photos ?? {}).length;
                const bits = [
                  r.ingredients.length ? `${r.ingredients.length} ingredient${r.ingredients.length === 1 ? "" : "s"}` : null,
                  link?.ok ? SITE_LABEL[link.site] : null,
                  photoCount ? `${photoCount} photo${photoCount === 1 ? "" : "s"}` : null,
                  r.rating ? `${"★".repeat(r.rating)}` : null,
                  lastCooked(r) !== null ? `made ${daysAgo(lastCooked(r)!, now)}` : null,
                ].filter(Boolean);
                const cover = coverPhoto(r.photos);
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => setOpenId(r.id)}
                      className="flex min-h-16 w-full items-center gap-3 rounded-2xl border border-border bg-surface px-3 py-2 text-left"
                    >
                      {cover && (
                        <RecipePhoto uid={uid} recipeId={r.id} photo={cover} alt="" className="h-14 w-14 shrink-0 rounded-xl" />
                      )}
                      <span className="flex min-w-0 flex-col px-1">
                        <span className="font-semibold">{r.title}</span>
                        <span className="text-xs text-muted">
                          {bits.join(" · ") || "Just a name so far"}
                          {r.pending && <span className="text-warn"> · waiting to sync</span>}
                        </span>
                        {r.tags.length > 0 && (
                          <span className="mt-0.5 truncate text-xs text-accent">{r.tags.map(tagLeaf).join(" · ")}</span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
      {editor}
      {making && (
        <WhatCanIMake
          recipes={recipes}
          staples={staples}
          onClose={() => setMaking(false)}
          onOpen={(id) => {
            setMaking(false);
            setOpenId(id);
          }}
          onSaveLink={(start) => {
            setMaking(false);
            setEditing({ mode: "new", start });
          }}
        />
      )}
    </div>
  );
}
