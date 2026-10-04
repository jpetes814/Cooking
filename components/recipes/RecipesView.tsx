"use client";

import { useState } from "react";
import { createRecipe, deleteRecipe, updateRecipe } from "@/lib/data/recipes";
import { parseLink, SITE_LABEL, type Recipe } from "@/lib/model/recipe";
import RecipeDetail from "./RecipeDetail";
import RecipeEditor from "./RecipeEditor";

type Editing = { mode: "new" } | { mode: "edit"; recipe: Recipe } | null;

/** The Recipes tab: your list, one recipe at a time, and the editor. */
export default function RecipesView({ uid, recipes }: { uid: string; recipes: Recipe[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const open = recipes.find((r) => r.id === openId) ?? null;

  const editor = editing && (
    <RecipeEditor
      existing={editing.mode === "edit" ? editing.recipe : undefined}
      onClose={() => setEditing(null)}
      onSave={(doc) => {
        if (editing.mode === "edit") updateRecipe(uid, editing.recipe.id, doc);
        else setOpenId(createRecipe(uid, doc));
        setEditing(null);
      }}
    />
  );

  if (open) {
    return (
      <>
        <RecipeDetail
          recipe={open}
          onBack={() => setOpenId(null)}
          onEdit={() => setEditing({ mode: "edit", recipe: open })}
          onDelete={() => {
            deleteRecipe(uid, open.id);
            setOpenId(null);
          }}
        />
        {editor}
      </>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">
          Your recipes{recipes.length > 0 && <span className="font-normal text-muted"> · {recipes.length}</span>}
        </h2>
        <button
          type="button"
          onClick={() => setEditing({ mode: "new" })}
          className="min-h-11 shrink-0 rounded-xl bg-accent px-4 font-semibold text-on-accent"
        >
          + Add recipe
        </button>
      </div>

      {recipes.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm leading-relaxed text-muted">
          No recipes yet. Tap <span className="font-medium text-text">Add recipe</span> to type one in, or paste a
          TikTok, Instagram, or YouTube link with a name. Photos and tags come next.
        </p>
      ) : (
        <ul className="space-y-2">
          {recipes.map((r) => {
            const link = r.source.url ? parseLink(r.source.url) : null;
            const bits = [
              r.ingredients.length ? `${r.ingredients.length} ingredient${r.ingredients.length === 1 ? "" : "s"}` : null,
              link?.ok ? SITE_LABEL[link.site] : null,
            ].filter(Boolean);
            return (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(r.id)}
                  className="flex min-h-16 w-full flex-col justify-center rounded-2xl border border-border bg-surface px-4 py-3 text-left"
                >
                  <span className="font-semibold">{r.title}</span>
                  <span className="text-xs text-muted">
                    {bits.join(" · ") || "Just a name so far"}
                    {r.pending && <span className="text-warn"> · waiting to sync</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {editor}
    </div>
  );
}
