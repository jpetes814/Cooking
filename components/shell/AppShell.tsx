"use client";

import { useState } from "react";
import TabBar, { type TabId } from "./TabBar";
import StatusLine from "./StatusLine";
import AccountMenu from "./AccountMenu";
import SetupNeeded from "./SetupNeeded";
import NotOnList from "./NotOnList";
import SignIn from "@/components/auth/SignIn";
import { useAuth } from "@/components/auth/useAuth";
import { usePantry } from "@/components/pantry/usePantry";
import PantryView from "@/components/pantry/PantryView";
import { useRecipes } from "@/components/recipes/useRecipes";
import RecipesView from "@/components/recipes/RecipesView";

// Tabs that don't have their real screen yet.
const COMING: Partial<Record<TabId, { title: string; body: string }>> = {
  shop: {
    title: "Shopping trips",
    body: "Pick a few recipes for the week and get one list, with the same ingredients added up and grouped by aisle. Check things off in the store, even with no signal.",
  },
};

export default function AppShell() {
  const auth = useAuth();

  if (auth.status === "loading") return <div className="h-full bg-bg" />;
  if (auth.status === "unconfigured") return <SetupNeeded />;
  if (auth.status === "signedOut") return <SignIn />;
  return <SignedIn uid={auth.uid} email={auth.email} />;
}

function SignedIn({ uid, email }: { uid: string; email: string }) {
  const [tab, setTab] = useState<TabId>("recipes");
  const pantry = usePantry(uid);
  const recipes = useRecipes(uid);

  if (pantry.status === "denied" || recipes.status === "denied") return <NotOnList email={email} />;
  const coming = COMING[tab];

  return (
    <div className="flex h-full flex-col">
      <header className="pt-safe border-b border-border bg-surface">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3 px-4 pb-3 pt-3">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold tracking-tight">Recipe Box</h1>
            <StatusLine />
          </div>
          <AccountMenu email={email} />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-xl px-4 py-5">
          {coming && (
            <section className="rounded-2xl border border-border bg-surface p-5">
              <h2 className="text-lg font-semibold">{coming.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{coming.body}</p>
              <p className="mt-3 text-xs font-medium text-accent">Coming soon</p>
            </section>
          )}
          {tab === "recipes" &&
            (recipes.status === "loading" ? (
              <p className="py-6 text-center text-sm text-muted">Loading...</p>
            ) : (
              <RecipesView uid={uid} recipes={recipes.recipes} />
            ))}
          {tab === "pantry" &&
            (pantry.status === "loading" ? (
              <p className="py-6 text-center text-sm text-muted">Loading...</p>
            ) : (
              <PantryView uid={uid} items={pantry.items} pending={pantry.pending} />
            ))}
        </div>
      </main>

      <TabBar active={tab} onChange={setTab} />
    </div>
  );
}
