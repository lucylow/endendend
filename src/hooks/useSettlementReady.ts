import { useCallback, useMemo, useState } from "react";
import type { MissionOutcomePacket } from "@/backend/arc/mission-outcome";
import {
  buildSettlementPreview,
  missionOutcomeToSettlementInput,
  signSettlementPreviewWithMockWallet,
} from "@/wallet/settlementBridge";
import type { SettlementPreview } from "@/wallet/types";
import { mockWalletAdapter, walletService } from "@/wallet/walletService";
import { useWallet } from "@/hooks/useWallet";

export function useSettlementReady() {
  const { account, isConnected, mode } = useWallet();
  const [lastPreview, setLastPreview] = useState<SettlementPreview | null>(null);
  const [busy, setBusy] = useState(false);

  const canPreviewSettlement = Boolean(isConnected && account);

  const buildPreview = useCallback(
    async (packet: MissionOutcomePacket): Promise<SettlementPreview | null> => {
      if (!account) return null;
      const input = missionOutcomeToSettlementInput(packet, account);
      const simulated = account.isMock;
      const preview = await buildSettlementPreview(input, simulated);
      setLastPreview(preview);
      return preview;
    },
    [account],
  );

  const signPreview = useCallback(async () => {
    if (!lastPreview || !account) return null;
    setBusy(true);
    try {
      if (mode === "mock") {
        const signed = await signSettlementPreviewWithMockWallet(mockWalletAdapter, lastPreview);
        setLastPreview(signed);
        return signed;
      }
      const msg = `Arc settlement commitment for mission artifact ${lastPreview.artifactId}\n${lastPreview.payloadHash}`;
      await walletService.signMessage(msg, "settlement_payload");
      const signed = { ...lastPreview, signedAt: Date.now(), mockReceipt: null };
      setLastPreview(signed);
      return signed;
    } finally {
      setBusy(false);
    }
  }, [account, lastPreview, mode]);

  const settlementReadyFromPacket = useCallback((packet: MissionOutcomePacket) => packet.settlementReady, []);

  return useMemo(
    () => ({
      canPreviewSettlement,
      lastPreview,
      buildPreview,
      signPreview,
      busy,
      settlementReadyFromPacket,
    }),
    [buildPreview, busy, canPreviewSettlement, lastPreview, settlementReadyFromPacket, signPreview],
  );
}
