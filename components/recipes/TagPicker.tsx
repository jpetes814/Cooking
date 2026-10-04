"use client";

import { useState } from "react";
import { MAX_TAGS, normalizeTag, SUGGESTED_TAGS, tagGroup, tagLeaf } from "@/lib/search/tags";

/** How a tag reads on a chip: "thai" with a small "cuisine" in front. */
export function TagLabel({ tag }: { tag: string }) {
  const group = tagGroup(tag);
  return (
    <>
      {group && <span className="mr-1 text-[11px] font-normal opacity-70">{group.split("/")[0]} ·</span>}
      {tagLeaf(tag)}
    </>
  );
}

/**
 * Tags in the editor. Type your own ("weeknight", or "cuisine/thai" for a
 * sub-tag), or tap one of the ideas. Tags you've used on other recipes show
 * first so the same ones get reused.
 */
export default function TagPicker({
  tags,
  used,
  onChange,
}: {
  tags: string[];
  used: string[];
  onChange: (tags: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function add(raw: string) {
    const tag = normalizeTag(raw);
    if (!tag) {
      setError(raw.trim() ? "Keep tags under 60 letters." : null);
      return;
    }
    if (tags.length >= MAX_TAGS) {
      setError(`A recipe can have up to ${MAX_TAGS} tags.`);
      return;
    }
    if (!tags.includes(tag)) onChange([...tags, tag].sort());
    setDraft("");
    setError(null);
  }

  const yours = used.filter((t) => !tags.includes(t));
  const groups = SUGGESTED_TAGS.map((g) => ({
    group: g.group,
    tags: g.tags.map((t) => `${g.group}/${t}`).filter((t) => !tags.includes(t) && !yours.includes(t)),
  })).filter((g) => g.tags.length);

  const chip = "min-h-10 rounded-full border px-3 text-sm";

  return (
    <div>
      <span className="text-sm font-medium">Tags</span>
      {tags.length > 0 && (
        <ul className="mt-1 flex flex-wrap gap-2" aria-label="This recipe's tags">
          {tags.map((t) => (
            <li key={t} className="flex min-h-10 items-center rounded-full bg-accent-soft py-1 pl-3 pr-1 text-sm font-medium text-accent">
              <TagLabel tag={t} />
              <button
                type="button"
                aria-label={`Remove tag ${t}`}
                onClick={() => onChange(tags.filter((x) => x !== t))}
                className="ml-1 flex h-8 w-8 items-center justify-center rounded-full text-lg"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 flex gap-2">
        <input
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(draft);
            }
          }}
          placeholder="weeknight, or cuisine/thai"
          aria-label="New tag"
          autoCapitalize="none"
          className="block min-h-11 w-full rounded-xl border border-border bg-bg px-3 text-base outline-none focus:border-accent"
        />
        <button type="button" onClick={() => add(draft)} className="min-h-11 shrink-0 rounded-xl border border-border px-4 font-medium">
          Add tag
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-1 text-sm text-warn">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="mt-2 min-h-10 text-sm font-medium text-accent"
      >
        {open ? "Hide tag ideas" : "Show tag ideas"}
      </button>
      {open && (
        <div className="mt-1 space-y-3">
          {yours.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Your tags</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {yours.map((t) => (
                  <button key={t} type="button" onClick={() => add(t)} aria-label={`Add tag ${t}`} className={`${chip} border-border bg-surface`}>
                    + <TagLabel tag={t} />
                  </button>
                ))}
              </div>
            </div>
          )}
          {groups.map((g) => (
            <div key={g.group}>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">{g.group}</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {g.tags.map((t) => (
                  <button key={t} type="button" onClick={() => add(t)} aria-label={`Add tag ${t}`} className={`${chip} border-border bg-surface`}>
                    + {tagLeaf(t)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
