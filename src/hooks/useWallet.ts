import { useCallback, useMemo } from "react";
import type { Connector } from "wagmi";
import type { DemoNetworkId } from "@/wallet/demoPersonas";
import { walletService } from "@/wallet/walletService";
import { useWalletStore } from "@/wallet/walletStore";
import type { SignaturePurpose, TypedDataPayload } from "@/wallet/types";

export function useWallet() {
  const connectionStatus = useWalletStore((s) => s.connectionStatus);
  const mode = useWalletStore((s) => s.mode);
  const account = useWalletStore((s) => s.account);
  const session = useWalletStore((s) => s.session);
  const demoPersonaId = useWalletStore((s) => s.demoPersonaId);
  const demoSeed = useWalletStore((s) => s.demoSeed);
  const signatureHistory = useWalletStore((s) => s.signatureHistory);
  const transactionHistory = useWalletStore((s) => s.transactionHistory);
  const connectedAt = useWalletStore((s) => s.connectedAt);
  const sessionRestoreStatus = useWalletStore((s) => s.sessionRestoreStatus);
  const error = useWalletStore((s) => s.error);
  const modalOpen = useWalletStore((s) => s.modalOpen);
  const selectedProviderLabel = useWalletStore((s) => s.selectedProviderLabel);
  const setModalOpen = useWalletStore((s) => s.setModalOpen);
  const resetError = useWalletStore((s) => s.resetError);

  const openModal = useCallback(() => setModalOpen(true), [setModalOpen]);
  const closeModal = useCallback(() => setModalOpen(false), [setModalOpen]);

  const connectDemo = useCallback(
    (opts?: { personaId?: string; networkId?: DemoNetworkId; seed?: string }) => walletService.connectDemo(opts),
    [],
  );
  const connectInjected = useCallback((c: Connector) => walletService.connectInjected(c), []);
  const disconnect = useCallback(() => walletService.disconnect(), []);
  const switchDemoPersona = useCallback((id: string) => walletService.switchDemoPersona(id), []);
  const setDemoNetwork = useCallback((id: DemoNetworkId) => walletService.setDemoNetwork(id), []);
  const signReadiness = useCallback((msg: string) => walletService.signMissionReadiness(msg), []);
  const signMessage = useCallback((msg: string, purpose?: SignaturePurpose) => walletService.signMessage(msg, purpose), []);
  const signTypedData = useCallback(
    (payload: TypedDataPayload, purpose?: SignaturePurpose) => walletService.signTypedData(payload, purpose),
    [],
  );
  const sendDemoTx = useCallback((to: `0x${string}`) => walletService.sendDemoTransaction(to), []);
  const resetDemoIdentity = useCallback(() => walletService.resetDemoIdentity(), []);
  const clearStaleRealSession = useCallback(() => walletService.clearStaleRealSession(), []);

  return useMemo(
    () => ({
      connectionStatus,
      mode,
      account,
      session,
      demoPersonaId,
      demoSeed,
      signatureHistory,
      transactionHistory,
      connectedAt,
      sessionRestoreStatus,
      error,
      modalOpen,
      selectedProviderLabel,
      isConnected: mode !== "disconnected" && account != null,
      openModal,
      closeModal,
      connectDemo,
      connectInjected,
      disconnect,
      switchDemoPersona,
      setDemoNetwork,
      signReadiness,
      signMessage,
      signTypedData,
      sendDemoTx,
      resetDemoIdentity,
      clearStaleRealSession,
      resetError,
    }),
    [
      account,
      clearStaleRealSession,
      connectDemo,
      connectInjected,
      connectionStatus,
      connectedAt,
      closeModal,
      demoPersonaId,
      demoSeed,
      disconnect,
      error,
      modalOpen,
      mode,
      openModal,
      resetDemoIdentity,
      resetError,
      selectedProviderLabel,
      sendDemoTx,
      session,
      sessionRestoreStatus,
      setDemoNetwork,
      signMessage,
      signReadiness,
      signTypedData,
      signatureHistory,
      switchDemoPersona,
      transactionHistory,
    ],
  );
}
