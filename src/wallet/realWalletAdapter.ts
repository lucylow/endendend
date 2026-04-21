import { mainnet, sepolia, localhost } from "wagmi/chains";
import type { Connector } from "wagmi";
import type {
  SendTransactionInput,
  SignaturePurpose,
  SignatureRecord,
  TransactionRecord,
  TypedDataPayload,
  WalletAccount,
  WalletAdapter,
  WalletSession,
} from "@/wallet/types";

export type WagmiSnapshot = {
  address: `0x${string}` | undefined;
  chainId: number | undefined;
  status: "connected" | "connecting" | "disconnected" | "reconnecting";
};

export type WagmiRuntime = {
  getSnapshot: () => WagmiSnapshot;
  connectInjected: (connector: Connector) => Promise<void>;
  disconnect: () => Promise<void>;
  signMessageAsync: (args: { message: string }) => Promise<`0x${string}`>;
  signTypedDataAsync: (args: {
    domain: Record<string, unknown>;
    types: Record<string, Array<{ name: string; type: string }>>;
    primaryType: string;
    message: Record<string, unknown>;
  }) => Promise<`0x${string}`>;
  sendTransactionAsync: (args: { to: `0x${string}`; value?: bigint; data?: `0x${string}` }) => Promise<`0x${string}`>;
};

function chainLabel(chainId: number | undefined): string {
  if (chainId === mainnet.id) return "Ethereum mainnet";
  if (chainId === sepolia.id) return "Sepolia testnet";
  if (chainId === localhost.id) return "Localhost devnet";
  if (chainId == null) return "Unknown network";
  return `Chain ${chainId}`;
}

function newRestoreToken(): string {
  const bytes = new Uint8Array(24);
  globalThis.crypto?.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export class RealWalletAdapter implements WalletAdapter {
  readonly id = "real-injected";
  readonly isMock = false;

  private runtime: WagmiRuntime | null = null;
  private session: WalletSession | null = null;

  bindRuntime(rt: WagmiRuntime | null): void {
    this.runtime = rt;
  }

  async connect(params?: Record<string, unknown>): Promise<void> {
    const connector = params?.connector as Connector | undefined;
    if (!this.runtime) throw new Error("provider_not_found: wallet runtime not ready");
    if (!connector) throw new Error("provider_not_found: no connector selected");
    await this.runtime.connectInjected(connector);
    const snap = this.runtime.getSnapshot();
    if (snap.status !== "connected" || !snap.address) throw new Error("connection_rejected");
    const now = Date.now();
    this.session = {
      sessionId: globalThis.crypto?.randomUUID?.() ?? `sess-${now}`,
      accountAddress: snap.address,
      providerType: "injected",
      demoMode: false,
      chainLabel: chainLabel(snap.chainId),
      chainId: snap.chainId ?? null,
      personaId: null,
      expirationMs: now + 24 * 60 * 60 * 1000,
      restoreToken: newRestoreToken(),
      lastActionAt: now,
      signatureCount: 0,
      transactionCount: 0,
      demoSeed: "",
      connectorLabel: connector.name,
    };
  }

  async disconnect(): Promise<void> {
    if (!this.runtime) return;
    await this.runtime.disconnect();
    this.session = null;
  }

  isConnected(): boolean {
    const snap = this.runtime?.getSnapshot();
    return snap?.status === "connected" && Boolean(snap.address);
  }

  getAccount(): WalletAccount | null {
    const snap = this.runtime?.getSnapshot();
    if (!snap || snap.status !== "connected" || !snap.address) return null;
    const now = Date.now();
    const short = `${snap.address.slice(0, 6)}…${snap.address.slice(-4)}`;
    const connectorName = this.session?.connectorLabel ?? "Injected wallet";
    return {
      address: snap.address,
      displayName: `${connectorName} · ${short}`,
      providerType: "injected",
      persona: null,
      chainId: snap.chainId ?? null,
      chainLabel: chainLabel(snap.chainId),
      connectedAt: this.session?.lastActionAt ?? now,
      lastSeenAt: now,
      isMock: false,
      metadata: { connector: connectorName },
      permissionsGranted: ["mission_signing", "settlement_preview"],
    };
  }

  getNetwork(): { chainId: number | null; label: string } {
    const snap = this.runtime?.getSnapshot();
    const chainId = snap?.chainId ?? null;
    return { chainId, label: chainLabel(chainId ?? undefined) };
  }

  getSession(): WalletSession | null {
    if (!this.isConnected()) return null;
    const snap = this.runtime!.getSnapshot();
    if (!this.session || !snap.address) return null;
    return {
      ...this.session,
      accountAddress: snap.address,
      chainLabel: chainLabel(snap.chainId),
      chainId: snap.chainId ?? null,
      lastActionAt: Date.now(),
      connectorLabel: this.session.connectorLabel ?? null,
    };
  }

  async restoreSession(session: WalletSession): Promise<boolean> {
    if (session.demoMode) return false;
    if (Date.now() > session.expirationMs) return false;
    const snap = this.runtime?.getSnapshot();
    if (!snap?.address) return false;
    if (snap.address.toLowerCase() !== session.accountAddress.toLowerCase()) return false;
    this.session = { ...session, lastActionAt: Date.now() };
    return true;
  }

  async signMessage(message: string, purpose: SignaturePurpose): Promise<SignatureRecord> {
    if (!this.runtime) throw new Error("signing_failed: runtime unavailable");
    const sig = await this.runtime.signMessageAsync({ message });
    return {
      id: `sig-${Date.now()}`,
      signedMessage: message,
      signature: sig,
      timestamp: Date.now(),
      purpose,
      status: "confirmed",
      simulated: false,
    };
  }

  async signTypedData(payload: TypedDataPayload, purpose: SignaturePurpose): Promise<SignatureRecord> {
    if (!this.runtime) throw new Error("signing_failed: runtime unavailable");
    const sig = await this.runtime.signTypedDataAsync({
      domain: payload.domain,
      types: payload.types,
      primaryType: payload.primaryType,
      message: payload.message,
    });
    return {
      id: `sig-${Date.now()}`,
      signedMessage: JSON.stringify(payload.message),
      signature: sig,
      timestamp: Date.now(),
      purpose,
      status: "confirmed",
      simulated: false,
    };
  }

  async sendTransaction(tx: SendTransactionInput): Promise<TransactionRecord> {
    if (!this.runtime) throw new Error("signing_failed: runtime unavailable");
    const hash = await this.runtime.sendTransactionAsync({
      to: tx.to,
      value: tx.value,
      data: tx.data,
    });
    return {
      id: `tx-${Date.now()}`,
      txHash: hash,
      destination: tx.to,
      amountOrPayload: tx.data ?? "0x",
      status: "submitted",
      receipt: null,
      timestamp: Date.now(),
      simulated: false,
    };
  }
}
