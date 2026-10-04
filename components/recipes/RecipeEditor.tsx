"use client";

import { useState } from "react";
import Sheet from "@/components/ui/Sheet";
import { TextArea, TextInput } from "@/components/ui/fields";
import { buildRecipe, toInput, type Recipe, type RecipeDoc } from "@/lib/model/recipe";

/**
 * Add or edit a recipe. Only the name is required, so a TikTok link and a
 * name is a complete recipe; the rest can be filled in later.
 */
export default function RecipeEditor({
  existing,
  onSave,
  onClose,
}: {
  existing?: Recipe;
  onSave: (recipe: RecipeDoc) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState(() => toInput(existing));
  const [error, setError] = useState<string | null>(null);
  const set = (key: keyof typeof form) => (v: string) => {
    setForm((f) => ({ ...f, [key]: v }));
    setError(null);
  };

  function save(e: React.FormEvent) {
    e.preventDefault();
    const built = buildRecipe(form, Date.now(), existing);
    if (!built.ok) {
      setError(built.error);
      return;
    }
    onSave(built.recipe);
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
