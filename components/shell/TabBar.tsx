"use client";

export type TabId = "recipes" | "shop" | "pantry";

export const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  {
    id: "recipes",
    label: "Recipes",
    icon: (
      <>
        <path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z" strokeLinejoin="round" />
        <path d="M5 17a3 3 0 0 1 3-3h11M9 8h6" strokeLinecap="round" />
      </>
    ),
  },
  {
    id: "shop",
    label: "Shop",
    icon: (
      <path
        d="M3 4h2l2.4 11h10.2L20 8H6.2M10 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM17 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    id: "pantry",
    label: "Pantry",
    icon: (
      <>
        <rect x="5" y="3" width="14" height="18" rx="2" />
        <path d="M5 10h14M5 16h14M9 7h2M9 13h2M9 19h2" strokeLinecap="round" />
      </>
    ),
  },
];

/** Bottom tab bar. Big tap targets, thumb-reachable, clears the iPhone home bar. */
export default function TabBar({ active, onChange }: { active: TabId; onChange: (id: TabId) => void }) {
  return (
    <nav className="pb-safe border-t border-border bg-surface" aria-label="Main">
      <ul className="mx-auto flex max-w-xl">
        {TABS.map((t) => {
          const on = t.id === active;
          return (
            <li key={t.id} className="flex-1">
              <button
                type="button"
                onClick={() => onChange(t.id)}
                aria-current={on ? "page" : undefined}
                className={`flex min-h-14 w-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
                  on ? "text-accent" : "text-muted"
                }`}
              >
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8}>
                  {t.icon}
                </svg>
                {t.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
