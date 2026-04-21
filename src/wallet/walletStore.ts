import { create } from "zustand";
import type { SignatureRecord, TransactionRecord, WalletAccount, WalletSession } from "@/wallet/types";
import type { WalletConnectionStatus, WalletErrorCode, WalletMode } from "@/wallet/types";

export type SessionRestoreStatus = "idle" | "ok" | "invalid" | "expired" | "corrupt";

export interface WalletStoreState {
  connectionStatus: WalletConnectionStatus;
  mode: WalletMode;
  selectedProviderLabel: string | null;
  account: WalletAccount | null;
  session: WalletSession | null;
  demoPersonaId: string | null;
  demoSeed: string;
  signatureHistory: SignatureRecord[];
  transactionHistory: TransactionRecord[];
  connectedAt: number | null;
  sessionRestoreStatus: SessionRestoreStatus;
  error: { code: WalletErrorCode; message: string } | null;
  modalOpen: boolean;
}

type WalletStoreActions = {
  resetError: () => void;
  setModalOpen: (open: boolean) => void;
  patch: (partial: Partial<WalletStoreState>) => void;
};

const initial: WalletStoreState = {
  connectionStatus: "idle",
  mode: "disconnected",
  selectedProviderLabel: null,
  account: null,
  session: null,
  demoPersonaId: null,
  demoSeed: "tashi-hackathon-demo-seed",
  signatureHistory: [],
  transactionHistory: [],
  connectedAt: null,
  sessionRestoreStatus: "idle",
  error: null,
  modalOpen: false,
};

export const useWalletStore = create<WalletStoreState & WalletStoreActions>((set) => ({
  ...initial,
  resetError: () => set({ error: null }),
  setModalOpen: (open) => set({ modalOpen: open }),
  patch: (partial) => set(partial),
}));

export function resetWalletStoreForTests(): void {
  useWalletStore.setState({ ...initial });
}
