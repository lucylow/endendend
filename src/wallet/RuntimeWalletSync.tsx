import { useEffect } from "react";
import { useWalletStore } from "@/wallet/walletStore";
import { useRuntimeStore } from "@/lib/state/runtimeStore";
import { buildDisconnectedView } from "@/lib/wallet/walletService";
import { MOCK_WALLET_CHAIN_ID } from "@/lib/wallet/mockWallet";

/**
 * Mirrors the global operator wallet into the Tashi workspace runtime store so
 * `settlementPreviewFromEnvelope`, `sealSettlement`, and mission actions see the same operator id.
 */
export function RuntimeWalletSync() {
  const mode = useWalletStore((s) => s.mode);
  const account = useWalletStore((s) => s.account);

  useEffect(() => {
    if (mode === "mock" && account) {
      useRuntimeStore.setState({
        demoWalletPreferred: true,
        operatorActorId: account.address,
        wallet: {
          status: "demo",
          address: account.address,
          chainId: account.chainId ?? MOCK_WALLET_CHAIN_ID,
          label: `${account.displayName} (mock)`,
          source: "mock",
        },
      });
    } else if (mode === "real" && account) {
      useRuntimeStore.setState({
        demoWalletPreferred: false,
        operatorActorId: account.address,
        wallet: {
          status: "connected",
          address: account.address,
          chainId: account.chainId,
          label: account.displayName,
          source: "live",
        },
      });
    } else {
      useRuntimeStore.setState({
        demoWalletPreferred: false,
        operatorActorId: "operator-ui",
        wallet: buildDisconnectedView(),
      });
    }
    useRuntimeStore.getState().refreshFromLocal();
  }, [mode, account]);

  return null;
}
