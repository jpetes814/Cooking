"use client";

import { signOut } from "firebase/auth";
import { getFirebase } from "@/lib/firebase/client";

/** Signed in, but the email isn't in config/allowlist, so the rules refuse everything. */
export default function NotOnList({ email }: { email: string }) {
  return (
    <div className="pt-safe flex min-h-full flex-col justify-center px-6 py-10">
      <div className="mx-auto w-full max-w-sm rounded-2xl border border-border bg-surface p-6">
        <h1 className="text-xl font-bold">This account isn&apos;t on the list yet</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          You&apos;re signed in as <span className="font-medium text-text">{email}</span>, but that email isn&apos;t
          on the allowlist. Add it in Firebase under <span className="font-mono text-text">config/allowlist</span>{" "}
          (docs/SETUP.md, section 3), then reopen the app.
        </p>
        <button
          type="button"
          onClick={() => {
            const fb = getFirebase();
            if (fb) signOut(fb.auth);
          }}
          className="mt-5 min-h-12 w-full rounded-xl border border-border font-medium"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
