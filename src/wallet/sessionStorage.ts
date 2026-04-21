import { z } from "zod";
import type { WalletSession } from "@/wallet/types";

const STORAGE_KEY = "tashi.wallet.session.v1";

const sessionSchema = z.object({
  sessionId: z.string(),
  accountAddress: z.string(),
  providerType: z.enum(["mock", "injected", "external"]),
  demoMode: z.boolean(),
  chainLabel: z.string(),
  chainId: z.number().nullable(),
  personaId: z.string().nullable(),
  expirationMs: z.number(),
  restoreToken: z.string(),
  lastActionAt: z.number(),
  signatureCount: z.number(),
  transactionCount: z.number(),
  demoSeed: z.string(),
  connectorLabel: z.string().nullable().optional(),
});

export type PersistedWalletBlob = z.infer<typeof sessionSchema>;

export function readPersistedSession(): PersistedWalletBlob | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    const r = sessionSchema.safeParse(parsed);
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

export function writePersistedSession(session: WalletSession): void {
  if (typeof window === "undefined") return;
  const blob: PersistedWalletBlob = {
    sessionId: session.sessionId,
    accountAddress: session.accountAddress,
    providerType: session.providerType === "injected" ? "injected" : session.demoMode ? "mock" : session.providerType,
    demoMode: session.demoMode,
    chainLabel: session.chainLabel,
    chainId: session.chainId,
    personaId: session.personaId,
    expirationMs: session.expirationMs,
    restoreToken: session.restoreToken,
    lastActionAt: session.lastActionAt,
    signatureCount: session.signatureCount,
    transactionCount: session.transactionCount,
    demoSeed: session.demoSeed,
    connectorLabel: session.connectorLabel ?? undefined,
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(blob));
}

export function clearPersistedSession(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export function persistedToWalletSession(p: PersistedWalletBlob): WalletSession {
  return {
    sessionId: p.sessionId,
    accountAddress: p.accountAddress,
    providerType: p.demoMode ? "mock" : p.providerType === "external" ? "injected" : p.providerType,
    demoMode: p.demoMode,
    chainLabel: p.chainLabel,
    chainId: p.chainId,
    personaId: p.personaId,
    expirationMs: p.expirationMs,
    restoreToken: p.restoreToken,
    lastActionAt: p.lastActionAt,
    signatureCount: p.signatureCount,
    transactionCount: p.transactionCount,
    demoSeed: p.demoSeed,
    connectorLabel: p.connectorLabel ?? null,
  };
}
