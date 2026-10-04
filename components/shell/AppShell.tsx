"use client";

import { useState } from "react";
import TabBar, { type TabId } from "./TabBar";
import StatusLine from "./StatusLine";

// What each tab will hold, and which build step brings it.
const COMING: Record<TabId, { title: string; body: string }> = {
  recipes: {
    title: "Your recipes",
    body: "Snap a cookbook page, save a screenshot, or paste a TikTok, Instagram, or YouTube link. Tag it (soups, fall, weeknight...) and find it again by tag or by what's in it. Sign-in and saving come next.",
  },
  shop: {
    title: "Shopping trips",
    body: "Pick a few recipes for the week and get one list, with the same ingredients added up and grouped by aisle. Check things off in the store, even with no signal.",
  },
  pantry: {
    title: "Pantry staples",
    body: "Salt, oil, the things you always have. They stay off your shopping list unless you ask for them.",
  },
};

export default function AppShell() {
  const [tab, setTab] = useState<TabId>("recipes");
  const coming = COMING[tab];

  return (
    <div className="flex h-full flex-col">
      <header className="pt-safe border-b border-border bg-surface">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3 px-4 pb-3 pt-3">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold tracking-tight">Recipe Box</h1>
            <StatusLine />
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-xl px-4 py-5">
          <section className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="text-lg font-semibold">{coming.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{coming.body}</p>
            <p className="mt-3 text-xs font-medium text-accent">Coming soon</p>
          </section>
        </div>
      </main>

      <TabBar active={tab} onChange={setTab} />
    </div>
  );
}
