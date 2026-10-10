"use client";

/** A − value + control with thumb-sized buttons. */
export default function Stepper({
  value,
  label,
  onStep,
  canDown,
  canUp,
}: {
  /** Shown between the buttons, e.g. "Serves 4" or "2×". */
  value: string;
  /** What's being changed, for screen readers: "servings for Lemon pasta". */
  label: string;
  onStep: (dir: 1 | -1) => void;
  canDown: boolean;
  canUp: boolean;
}) {
  const btn =
    "flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface text-xl font-semibold text-accent disabled:opacity-40";
  return (
    <div role="group" aria-label={label} className="flex items-center gap-2">
      <button type="button" aria-label="Fewer" disabled={!canDown} onClick={() => onStep(-1)} className={btn}>
        −
      </button>
      <span aria-live="polite" data-testid="stepper-value" className="min-w-20 text-center text-sm font-semibold">
        {value}
      </span>
      <button type="button" aria-label="More" disabled={!canUp} onClick={() => onStep(1)} className={btn}>
        +
      </button>
    </div>
  );
}
