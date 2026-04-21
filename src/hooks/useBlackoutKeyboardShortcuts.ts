import { useEffect } from "react";

type Handlers = {
  onKillSelected?: () => void;
  onOpenSettlement?: () => void;
  onResetChain?: () => void;
};

function isTypingTarget(t: EventTarget | null): boolean {
  if (!t || !(t instanceof HTMLElement)) return false;
  const tag = t.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t.isContentEditable;
}

/**
 * Operator shortcuts (non-destructive defaults avoid clashing with browser reload).
 * Ctrl+Shift+K kill selected · Ctrl+Shift+S settlement · Ctrl+Shift+R reset relay stress (caller maps).
 */
export function useBlackoutKeyboardShortcuts(h: Handlers, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (!e.ctrlKey || !e.shiftKey || isTypingTarget(e.target)) return;
      const k = e.key.toLowerCase();
      if (k === "k") {
        e.preventDefault();
        h.onKillSelected?.();
      } else if (k === "s") {
        e.preventDefault();
        h.onOpenSettlement?.();
      } else if (k === "r") {
        e.preventDefault();
        h.onResetChain?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, h.onKillSelected, h.onOpenSettlement, h.onResetChain]);
}
