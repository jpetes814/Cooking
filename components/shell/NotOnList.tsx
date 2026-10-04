"use client";

import { signOut } from "firebase/auth";
import { getFirebase } from "@/lib/firebase/client";

/**
 * The security rules said no. If nothing at all is readable, the email isn't
 * in config/allowlist. If some data loads but newer data doesn't, the Firebase
 * project still has older rules than this version of the app.
 */
export default function NotOnList({ email, reason }: { email: string; reason: "notListed" | "rulesOutdated" }) {
  return (
    <div className="pt-safe flex min-h-full flex-col justify-center px-6 py-10">
      <div className="mx-auto w-full max-w-sm rounded-2xl border border-border bg-surface p-6">
        {reason === "notListed" ? (
          <>
            <h1 className="text-xl font-bold">This account isn&apos;t on the list yet</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              You&apos;re signed in as <span className="font-medium text-text">{email}</span>, but that email isn&apos;t
              on the allowlist. Add it in Firebase under <span className="font-mono text-text">config/allowlist</span>{" "}
              (docs/SETUP.md, section 3), then reopen the app.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold">The Firebase rules need updating</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              This version of the app saves things the database&apos;s security rules don&apos;t know about yet. Copy{" "}
              <span className="font-mono text-text">firestore.rules</span> from GitHub into Firebase under{" "}
              <span className="font-mono text-text">Firestore Database &gt; Rules</span>, tap Publish, then reopen the
              app.
            </p>
          </>
        )}
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
