"use client";

import { useState } from "react";
import { inputClass } from "@/components/ui/fields";
import { MAX_NEXT_TIME, tidyNextTime } from "@/lib/model/cooking";

/**
 * "Next time": what you'd change when you make it again. Kept apart from the
 * recipe's own notes and saved on its own, so editing the recipe never loses it.
 */
export default function NextTimeNotes({
  text,
  pending,
  editing,
  onEditing,
  onSave,
}: {
  text: string;
  pending: boolean;
  editing: boolean;
  onEditing: (on: boolean) => void;
  onSave: (text: string) => void;
}) {
  if (editing) {
    return (
      <NextTimeEditor
        initial={text}
        onCancel={() => onEditing(false)}
        onSave={(t) => {
          if (t !== text) onSave(t);
          onEditing(false);
        }}
      />
    );
  }

  if (!text) {
    return (
      <button
        type="button"
        onClick={() => onEditing(true)}
        className="min-h-11 w-full rounded-2xl border border-dashed border-border px-4 text-left text-sm font-medium text-accent"
      >
        + Add a note for next time
      </button>
    );
  }

  return (
    <section aria-label="Next time" className="rounded-2xl border-l-4 border-warn bg-surface-2 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">Next time</h3>
        <button type="button" onClick={() => onEditing(true)} className="-my-2 min-h-11 px-2 text-sm font-medium text-accent">
          Edit note
        </button>
      </div>
      <p data-testid="next-time" className="mt-1 whitespace-pre-line text-base leading-relaxed">
        {text}
      </p>
      {pending && <p className="mt-1 text-xs text-warn">Waiting to sync</p>}
    </section>
  );
}

function NextTimeEditor({
  initial,
  onCancel,
  onSave,
}: {
  initial: string;
  onCancel: () => void;
  onSave: (text: string) => void;
}) {
  const [draft, setDraft] = useState(initial);
  return (
    <section aria-label="Next time" className="rounded-2xl border-l-4 border-warn bg-surface-2 p-4">
      <label className="block">
        <span className="font-semibold">Next time</span>
        <span className="block text-xs text-muted">Anything you&apos;d change: less salt, a bigger pan, double the sauce.</span>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={4}
          maxLength={MAX_NEXT_TIME}
          autoFocus
          className={`${inputClass} py-2`}
        />
      </label>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={onCancel} className="min-h-11 flex-1 rounded-xl border border-border font-medium">
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onSave(tidyNextTime(draft))}
          className="min-h-11 flex-1 rounded-xl bg-accent font-semibold text-on-accent"
        >
          Save note
        </button>
      </div>
    </section>
  );
}
