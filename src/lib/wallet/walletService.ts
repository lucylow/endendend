import type { WalletSessionViewModel } from "@/lib/state/types";
import type { WalletPersisted } from "./types";
import { deterministicDemoAddress, MOCK_WALLET_CHAIN_ID } from "./mockWallet";

const KEY = "tashi-wallet-session-v1";

export function loadWalletSession(): WalletPersisted | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as WalletPersisted;
    if (!p || typeof p.savedAtMs !== "number") return null;
    if (Date.now() - p.savedAtMs > 86400000 * 14) return null;
    return p;
  } catch {
    return null;
  }
}

export function saveWalletSession(p: WalletPersisted): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

export function clearWalletSession(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function buildDemoWalletView(seed: string): WalletSessionViewModel {
  const addr = deterministicDemoAddress(seed);
  return {
    status: "demo",
    address: addr,
    chainId: MOCK_WALLET_CHAIN_ID,
    label: "Demo signer (simulated)",
    source: "mock",
  };
}

export function buildDisconnectedView(): WalletSessionViewModel {
  return {
    status: "disconnected",
    address: null,
    chainId: null,
    label: "No wallet",
    source: "fallback",
  };
}
