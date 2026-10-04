"use client";

import { useState } from "react";
import { signOut } from "firebase/auth";
import Sheet from "@/components/ui/Sheet";
import { getFirebase } from "@/lib/firebase/client";

/** The round initial in the header: who's signed in, and sign out. */
export default function AccountMenu({ email }: { email: string }) {
  const [open, setOpen] = useState(false);

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
            onClick={() => {
              const fb = getFirebase();
              if (fb) signOut(fb.auth);
              setOpen(false);
            }}
            className="mt-6 min-h-12 w-full rounded-xl border border-border font-medium text-warn"
          >
            Sign out
          </button>
          <p className="mt-1 text-xs text-muted">Signing back in needs signal.</p>
        </Sheet>
      )}
    </>
  );
}
