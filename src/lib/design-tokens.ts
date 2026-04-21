/**
 * BLACKOUT command-centre design tokens.
 * Prefer importing constants here and mapping to Tailwind classes in components
 * rather than scattering raw hex values across the UI.
 */

export const colors = {
  backgroundDeep: "#09090b",
  background: "#18181b",
  surface: "#27272a",
  primary: "#0ea5e9",
  healthy: "#10b981",
  warning: "#f59e0b",
  critical: "#ef4444",
  settlement: "#8b5cf6",
  borderSubtle: "#3f3f46",
  foreground: "#fafafa",
  muted: "#a1a1aa",
} as const;

/** Tailwind class bundles aligned with tokens (dark ops chrome). */
export const chrome = {
  page: "min-h-screen bg-zinc-950 text-zinc-50",
  panel: "bg-zinc-900/80 border-zinc-800/80",
  topBar: "border-b border-zinc-800/90 bg-zinc-950/95 backdrop-blur-sm",
  focusRing: "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950",
} as const;

export const spacing = {
  panelPadding: "p-4 md:p-6",
  cardPadding: "p-4",
  sectionGap: "gap-4 md:gap-6",
  touchMin: "min-h-11 min-w-11",
} as const;

export const typography = {
  /** Headings, UI labels */
  sans: "font-sans tracking-tight",
  /** Logs, telemetry, hashes */
  mono: "font-mono text-[11px] leading-relaxed",
  headingLg: "text-2xl font-semibold",
  headingSm: "text-sm font-semibold uppercase tracking-wider text-zinc-400",
} as const;

export const animation = {
  transitionFast: "transition-colors duration-150",
  transitionPanel: "transition-opacity duration-200",
  pulseDot: "animate-pulse",
} as const;
