"use client";

import { useRef, useState } from "react";
import Sheet from "@/components/ui/Sheet";
import { importBackup } from "@/lib/data/backup";
import { backupFileName, makeBackup, newStaples, planImport, readBackup } from "@/lib/model/backup";
import type { Recipe, RecipeDoc } from "@/lib/model/recipe";

type Plan = { toAdd: RecipeDoc[]; skipped: number; unreadable: number; staples: string[] };

/**
 * Download everything as one file, or bring a file in. Copying from the test
 * app to the real one is a download in one and an import in the other.
 */
export default function BackupSheet({
  uid,
  recipes,
  staples,
  onClose,
}: {
  uid: string;
  recipes: Recipe[];
  staples: string[];
  onClose: () => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);

  async function download() {
    const now = Date.now();
    const name = backupFileName(now);
    const file = new File([JSON.stringify(makeBackup(recipes, staples, now), null, 1)], name, { type: "application/json" });
    // On a phone, the share sheet is the friendly way to save a file (Save to Files, AirDrop, email).
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Recipe Box backup" });
        setNote({ tone: "ok", text: "Backup ready. Keep the file somewhere safe, like Files or iCloud Drive." });
        return;
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    setNote({ tone: "ok", text: `Saved ${name}.` });
  }

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setNote(null);
    const read = readBackup(await file.text());
    if (!read.ok) {
      setPlan(null);
      setNote({ tone: "warn", text: read.error });
      return;
    }
    const { toAdd, skipped } = planImport(read.recipes, recipes);
    setPlan({ toAdd, skipped, unreadable: read.unreadable, staples: newStaples(read.pantry, staples) });
  }

  function confirm() {
    if (!plan) return;
    importBackup(uid, plan.toAdd, plan.staples, Date.now());
    setNote({
      tone: "ok",
      text: `Added ${plan.toAdd.length} recipe${plan.toAdd.length === 1 ? "" : "s"}${plan.staples.length ? ` and ${plan.staples.length} staple${plan.staples.length === 1 ? "" : "s"}` : ""}.`,
    });
    setPlan(null);
  }

  return (
    <Sheet title="Backup and copy" onClose={onClose}>
      <section aria-label="Download a backup">
        <h3 className="font-semibold">Download a backup</h3>
        <p className="mt-1 text-sm text-muted">
          {recipes.length === 0
            ? "Your pantry staples in one file. Add some recipes and they'll come along too."
            : `All ${recipes.length} recipe${recipes.length === 1 ? "" : "s"} and your pantry staples in one file. Photos aren't included yet.`}
        </p>
        <button type="button" onClick={download} className="mt-3 min-h-12 w-full rounded-xl bg-accent font-semibold text-on-accent">
          Download backup
        </button>
      </section>

      <section aria-label="Import from a backup" className="mt-6 border-t border-border pt-4">
        <h3 className="font-semibold">Import from a backup</h3>
        <p className="mt-1 text-sm text-muted">
          Adds recipes from a backup file to this app, skipping any you already have. Use it to copy recipes from the test app to the real
          one.
        </p>
        <input ref={fileInput} type="file" accept="application/json,.json" onChange={pick} className="hidden" aria-label="Backup file" />
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="mt-3 min-h-12 w-full rounded-xl border border-accent bg-accent-soft font-semibold text-accent"
        >
          Choose a backup file
        </button>

        {plan && (
          <div role="region" aria-label="Ready to import" className="mt-3 rounded-2xl border border-border bg-bg p-3 text-sm">
            {plan.toAdd.length === 0 && plan.staples.length === 0 ? (
              <p>Everything in this backup is already here, so there&apos;s nothing to add.</p>
            ) : (
              <p>
                Add <span className="font-semibold">{plan.toAdd.length}</span> recipe{plan.toAdd.length === 1 ? "" : "s"}
                {plan.staples.length > 0 && ` and ${plan.staples.length} pantry staple${plan.staples.length === 1 ? "" : "s"}`}?
              </p>
            )}
            {plan.skipped > 0 && <p className="mt-1 text-muted">{plan.skipped} already here, so they&apos;ll be skipped.</p>}
            {plan.unreadable > 0 && <p className="mt-1 text-warn">{plan.unreadable} couldn&apos;t be read and will be left out.</p>}
            <p className="mt-1 text-muted">Photos don&apos;t come along. Add them again from the recipe if you want them.</p>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => setPlan(null)} className="min-h-11 flex-1 rounded-xl border border-border font-medium">
                Cancel
              </button>
              {(plan.toAdd.length > 0 || plan.staples.length > 0) && (
                <button type="button" onClick={confirm} className="min-h-11 flex-1 rounded-xl bg-accent font-semibold text-on-accent">
                  Import
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      {note && (
        <p role="status" className={`mt-4 text-sm ${note.tone === "ok" ? "text-ok" : "text-warn"}`}>
          {note.text}
        </p>
      )}
    </Sheet>
  );
}
