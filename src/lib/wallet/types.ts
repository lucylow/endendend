export type WalletConnectMode = "injected" | "demo";

export type WalletPersisted = {
  mode: WalletConnectMode;
  address: string | null;
  chainId: number | null;
  savedAtMs: number;
};
