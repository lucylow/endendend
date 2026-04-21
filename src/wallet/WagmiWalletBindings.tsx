import { useEffect, useMemo } from "react";
import { useAccount, useChainId, useConnect, useDisconnect, useSignMessage, useWalletClient } from "wagmi";
import { mainnet, sepolia, localhost } from "wagmi/chains";
import type { WagmiRuntime } from "@/wallet/realWalletAdapter";
import { walletService } from "@/wallet/walletService";

function chainForId(id: number | undefined) {
  if (id === mainnet.id) return mainnet;
  if (id === sepolia.id) return sepolia;
  if (id === localhost.id) return localhost;
  return sepolia;
}

/**
 * Registers wagmi-powered wallet operations with {@link walletService} and keeps real-wallet store state in sync.
 * Must render under `WagmiProvider`.
 */
export function WagmiWalletBindings() {
  const { address, status } = useAccount();
  const chainId = useChainId();
  const { connectAsync } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const { data: walletClient } = useWalletClient();

  const runtime = useMemo((): WagmiRuntime | null => {
    return {
      getSnapshot: () => ({
        address: address as `0x${string}` | undefined,
        chainId,
        status: status as "connected" | "connecting" | "disconnected" | "reconnecting",
      }),
      connectInjected: (connector) => connectAsync({ connector }),
      disconnect: () => disconnectAsync(),
      signMessageAsync: ({ message }) => signMessageAsync({ message }),
      signTypedDataAsync: async (args) => {
        if (!walletClient || !address) throw new Error("signing_failed: wallet unavailable");
        return walletClient.signTypedData({
          account: address,
          domain: args.domain as never,
          types: args.types as never,
          primaryType: args.primaryType as never,
          message: args.message as never,
        });
      },
      sendTransactionAsync: async ({ to, value, data }) => {
        if (!walletClient || !address) throw new Error("signing_failed: wallet unavailable");
        const chain = chainForId(chainId);
        return walletClient.sendTransaction({
          account: address,
          chain,
          to,
          value,
          data,
        });
      },
    };
  }, [address, chainId, connectAsync, disconnectAsync, signMessageAsync, status, walletClient]);

  useEffect(() => {
    walletService.registerWagmiRuntime(runtime);
    return () => walletService.registerWagmiRuntime(null);
  }, [runtime]);

  useEffect(() => {
    walletService.syncFromWagmi();
  }, [address, status, chainId, walletClient]);

  return null;
}
