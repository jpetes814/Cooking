"use client";

import { useState } from "react";
import { signOut } from "firebase/auth";
import Sheet from "@/components/ui/Sheet";
import { getFirebase } from "@/lib/firebase/client";
import type { Recipe } from "@/lib/model/recipe";
import BackupSheet from "./BackupSheet";

/** The round initial in the header: who's signed in, and sign out. */
export default function AccountMenu({
  email,
  uid,
  recipes,
  staples,
}: {
  email: string;
  uid: string;
  /** Null while they're still loading. */
  recipes: Recipe[] | null;
  staples: string[];
}) {
  const [open, setOpen] = useState(false);
  const [backup, setBackup] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Account"
        className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-sm font-bold uppercase text-accent"
      >
        {email.charAt(0)}
      </button>
      {open && (
        <Sheet title="Account" onClose={() => setOpen(false)}>
          <p className="text-sm text-muted">Signed in as</p>
          <p className="font-medium">{email}</p>

          <button
            type="button"
            disabled={!recipes}
            onClick={() => {
              setOpen(false);
              setBackup(true);
            }}
            className="mt-6 min-h-12 w-full rounded-xl border border-border font-medium disabled:opacity-60"
          >
            Backup and copy
          </button>

          <button
            type="button"
            onClick={() => {
              const fb = getFirebase();
              if (fb) signOut(fb.auth);
              setOpen(false);
            }}
            className="mt-3 min-h-12 w-full rounded-xl border border-border font-medium text-warn"
          >
            Sign out
          </button>
          <p className="mt-1 text-xs text-muted">Signing back in needs signal.</p>
        </Sheet>
      )}
      {backup && recipes && <BackupSheet uid={uid} recipes={recipes} staples={staples} onClose={() => setBackup(false)} />}
    </>
  );
}
