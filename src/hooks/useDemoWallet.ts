import { useMemo } from "react";
import { useWallet } from "@/hooks/useWallet";

/** Narrow helpers for SAR demo flows that always assume mock semantics when active. */
export function useDemoWallet() {
  const w = useWallet();
  return useMemo(
    () => ({
      isDemoActive: w.mode === "mock" && w.isConnected,
      personaId: w.demoPersonaId,
      demoSeed: w.demoSeed,
      mockBalanceLabel: w.account?.persona?.mockBalance ?? null,
      connectDemo: w.connectDemo,
      switchDemoPersona: w.switchDemoPersona,
      setDemoNetwork: w.setDemoNetwork,
      resetDemoIdentity: w.resetDemoIdentity,
    }),
    [w],
  );
}
