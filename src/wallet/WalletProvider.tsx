import { useEffect, type ReactNode } from "react";
import { WagmiWalletBindings } from "@/wallet/WagmiWalletBindings";
import { RuntimeWalletSync } from "@/wallet/RuntimeWalletSync";
import { walletService } from "@/wallet/walletService";

export function WalletProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    void walletService.restorePersistedSession();
  }, []);

  return (
    <>
      <WagmiWalletBindings />
      <RuntimeWalletSync />
      {children}
    </>
  );
}
