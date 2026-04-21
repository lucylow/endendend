import { mainnet, sepolia, localhost } from "wagmi/chains";
import type { Connector } from "wagmi";
import { DEFAULT_DEMO_PERSONA_ID, type DemoNetworkId, getDemoPersonaById } from "@/wallet/demoPersonas";
import { MockWalletAdapter } from "@/wallet/mockWallet";
import { RealWalletAdapter } from "@/wallet/realWalletAdapter";
import type { WagmiRuntime } from "@/wallet/realWalletAdapter";
import {
  clearPersistedSession,
  persistedToWalletSession,
  readPersistedSession,
  writePersistedSession,
} from "@/wallet/sessionStorage";
import type { SignaturePurpose, TypedDataPayload, WalletErrorCode, WalletSession } from "@/wallet/types";
import { emitWalletConnected, emitWalletDisconnected, emitWalletPersonaChanged } from "@/wallet/events";
import { useWalletStore } from "@/wallet/walletStore";

const SUPPORTED_CHAIN_IDS = new Set([mainnet.id, sepolia.id, localhost.id]);

export const mockWalletAdapter = new MockWalletAdapter();
const realWalletAdapter = new RealWalletAdapter();

function mapErr(e: unknown): { code: WalletErrorCode; message: string } {
  const msg = e instanceof Error ? e.message : String(e);
  const lower = msg.toLowerCase();
  if (lower.includes("provider_not_found") || lower.includes("connector not found"))
    return { code: "provider_not_found", message: "No wallet provider was found. Install a browser wallet or use the demo wallet." };
  if (lower.includes("rejected") || lower.includes("denied") || lower.includes("user rejected"))
    return { code: "connection_rejected", message: "The wallet declined the request." };
  if (lower.includes("invalid_session")) return { code: "invalid_session", message: "Your saved session is invalid. Connect again." };
  if (lower.includes("stale_session")) return { code: "stale_session", message: "Session restore incomplete — reconnect your wallet." };
  if (lower.includes("unsupported_network"))
    return { code: "unsupported_network", message: "This network is not supported for protocol actions yet." };
  if (lower.includes("mock_misconfigured")) return { code: "mock_misconfigured", message: "Demo wallet configuration error." };
  if (lower.includes("settlement_unavailable"))
    return { code: "settlement_unavailable", message: "Settlement service is unavailable. Try again later." };
  if (lower.includes("signing_failed"))
    return { code: "signing_failed", message: "Signing failed. Check the wallet popup or try again." };
  return { code: "unknown", message: msg || "Something went wrong with the wallet." };
}

function assertSupportedChain(chainId: number | null | undefined): void {
  if (chainId == null) return;
  if (!SUPPORTED_CHAIN_IDS.has(chainId)) {
    throw new Error("unsupported_network");
  }
}

export const walletService = {
  registerWagmiRuntime(rt: WagmiRuntime | null): void {
    realWalletAdapter.bindRuntime(rt);
  },

  async restorePersistedSession(): Promise<void> {
    useWalletStore.getState().patch({
      connectionStatus: "restoring",
      sessionRestoreStatus: "idle",
      error: null,
    });
    const blob = readPersistedSession();
    if (!blob) {
      useWalletStore.getState().patch({ connectionStatus: "idle", sessionRestoreStatus: "idle" });
      return;
    }
    const session = persistedToWalletSession(blob);
    if (Date.now() > session.expirationMs) {
      clearPersistedSession();
      useWalletStore.getState().patch({
        connectionStatus: "idle",
        sessionRestoreStatus: "expired",
        error: { code: "stale_session", message: "Your previous session expired. Connect again." },
      });
      return;
    }
    try {
      if (session.demoMode) {
        mockWalletAdapter.setDemoSeed(session.demoSeed);
        mockWalletAdapter.setPersona(session.personaId ?? DEFAULT_DEMO_PERSONA_ID);
        const ok = await mockWalletAdapter.restoreSession(session);
        if (!ok) throw new Error("invalid_session");
        const account = mockWalletAdapter.getAccount();
        const s = mockWalletAdapter.getSession();
        useWalletStore.getState().patch({
          mode: "mock",
          connectionStatus: "connected",
          account,
          session: s,
          demoPersonaId: session.personaId,
          demoSeed: session.demoSeed,
          selectedProviderLabel: "Mock demo wallet",
          connectedAt: account?.connectedAt ?? Date.now(),
          sessionRestoreStatus: "ok",
        });
        emitWalletConnected({
          mode: "mock",
          address: account!.address,
          isMock: true,
          personaId: session.personaId,
        });
        return;
      }
      const ok = await realWalletAdapter.restoreSession(session);
      if (!ok) throw new Error("invalid_session");
      useWalletStore.getState().patch({
        mode: "disconnected",
        connectionStatus: "idle",
        sessionRestoreStatus: "stale",
        session,
        account: null,
        error: {
          code: "stale_session",
          message: "Found a saved operator session. Reconnect the same browser wallet to resume signing and settlement previews.",
        },
        demoPersonaId: null,
        selectedProviderLabel: "Injected wallet",
      });
    } catch {
      clearPersistedSession();
      useWalletStore.getState().patch({
        connectionStatus: "idle",
        sessionRestoreStatus: "corrupt",
        error: { code: "invalid_session", message: "Stored session was unreadable and has been cleared." },
      });
    }
  },

  syncFromWagmi(): void {
    const mode = useWalletStore.getState().mode;
    if (mode === "mock") return;
    if (!realWalletAdapter.isConnected()) {
      if (mode === "real") {
        clearPersistedSession();
        useWalletStore.getState().patch({
          mode: "disconnected",
          connectionStatus: "idle",
          account: null,
          session: null,
          selectedProviderLabel: null,
          connectedAt: null,
        });
        emitWalletDisconnected();
      }
      return;
    }
    try {
      const net = realWalletAdapter.getNetwork();
      assertSupportedChain(net.chainId ?? undefined);
    } catch {
      useWalletStore.getState().patch({
        error: mapErr(new Error("unsupported_network")),
        connectionStatus: "connected",
      });
    }
    const account = realWalletAdapter.getAccount();
    const session = realWalletAdapter.getSession();
    if (!account || !session) return;
    useWalletStore.getState().patch({
      mode: "real",
      connectionStatus: "connected",
      account,
      session,
      selectedProviderLabel: account.displayName,
      connectedAt: session.lastActionAt,
      error: null,
      sessionRestoreStatus: "ok",
    });
    writePersistedSession(session);
  },

  async connectDemo(opts?: { personaId?: string; networkId?: DemoNetworkId; seed?: string }): Promise<boolean> {
    useWalletStore.getState().patch({ connectionStatus: "connecting", error: null });
    try {
      if (realWalletAdapter.isConnected()) {
        await realWalletAdapter.disconnect();
      }
      if (opts?.seed) {
        mockWalletAdapter.setDemoSeed(opts.seed);
        useWalletStore.getState().patch({ demoSeed: opts.seed });
      } else {
        mockWalletAdapter.setDemoSeed(useWalletStore.getState().demoSeed);
      }
      const pid = opts?.personaId ?? useWalletStore.getState().demoPersonaId ?? DEFAULT_DEMO_PERSONA_ID;
      mockWalletAdapter.setPersona(pid);
      const persona = getDemoPersonaById(pid);
      mockWalletAdapter.setNetwork(opts?.networkId ?? persona?.defaultNetwork ?? "vertex-demo-network");
      await mockWalletAdapter.connect();
      const session = mockWalletAdapter.getSession();
      const account = mockWalletAdapter.getAccount();
      if (!session || !account) throw new Error("invalid_session");
      writePersistedSession(session);
      useWalletStore.getState().patch({
        mode: "mock",
        connectionStatus: "connected",
        account,
        session,
        demoPersonaId: session.personaId,
        demoSeed: session.demoSeed,
        selectedProviderLabel: "Mock demo wallet",
        connectedAt: Date.now(),
        sessionRestoreStatus: "ok",
      });
      emitWalletConnected({
        mode: "mock",
        address: account.address,
        isMock: true,
        personaId: session.personaId,
      });
      return true;
    } catch (e) {
      useWalletStore.getState().patch({
        connectionStatus: "idle",
        error: mapErr(e),
      });
      return false;
    }
  },

  async connectInjected(connector: Connector): Promise<boolean> {
    useWalletStore.getState().patch({ connectionStatus: "connecting", error: null });
    try {
      if (mockWalletAdapter.isConnected()) {
        await mockWalletAdapter.disconnect();
      }
      await realWalletAdapter.connect({ connector });
      const net = realWalletAdapter.getNetwork();
      assertSupportedChain(net.chainId ?? undefined);
      const session = realWalletAdapter.getSession();
      const account = realWalletAdapter.getAccount();
      if (!session || !account) throw new Error("invalid_session");
      writePersistedSession(session);
      useWalletStore.getState().patch({
        mode: "real",
        connectionStatus: "connected",
        account,
        session,
        selectedProviderLabel: connector.name,
        connectedAt: Date.now(),
        sessionRestoreStatus: "ok",
        demoPersonaId: null,
      });
      emitWalletConnected({
        mode: "real",
        address: account.address,
        isMock: false,
        personaId: null,
      });
      return true;
    } catch (e) {
      useWalletStore.getState().patch({
        connectionStatus: "idle",
        error: mapErr(e),
      });
      return false;
    }
  },

  async disconnect(): Promise<void> {
    useWalletStore.getState().patch({ connectionStatus: "disconnecting", error: null });
    try {
      const mode = useWalletStore.getState().mode;
      if (mode === "mock") {
        await mockWalletAdapter.disconnect();
      } else if (mode === "real") {
        await realWalletAdapter.disconnect();
      }
      clearPersistedSession();
      useWalletStore.getState().patch({
        mode: "disconnected",
        connectionStatus: "idle",
        account: null,
        session: null,
        selectedProviderLabel: null,
        connectedAt: null,
        signatureHistory: [],
        transactionHistory: [],
      });
      emitWalletDisconnected();
    } catch (e) {
      useWalletStore.getState().patch({
        connectionStatus: "idle",
        error: mapErr(e),
      });
    }
  },

  async switchDemoPersona(personaId: string): Promise<void> {
    if (!getDemoPersonaById(personaId)) {
      useWalletStore.getState().patch({
        error: { code: "mock_misconfigured", message: "Unknown demo persona." },
      });
      return;
    }
    mockWalletAdapter.setPersona(personaId);
    if (!mockWalletAdapter.isConnected()) {
      useWalletStore.getState().patch({ demoPersonaId: personaId });
      return;
    }
    await mockWalletAdapter.refreshAccountAfterPersonaSwitch();
    const session = mockWalletAdapter.getSession();
    const account = mockWalletAdapter.getAccount();
    if (session) writePersistedSession(session);
    useWalletStore.getState().patch({
      demoPersonaId: personaId,
      account,
      session,
    });
    if (account) {
      emitWalletPersonaChanged({ personaId, address: account.address });
    }
  },

  async setDemoNetwork(networkId: DemoNetworkId): Promise<void> {
    mockWalletAdapter.setNetwork(networkId);
    if (mockWalletAdapter.isConnected()) {
      await mockWalletAdapter.refreshAccountAfterPersonaSwitch();
      const session = mockWalletAdapter.getSession();
      const account = mockWalletAdapter.getAccount();
      if (session) writePersistedSession(session);
      useWalletStore.getState().patch({ account, session });
    }
  },

  async signMissionReadiness(message: string): Promise<void> {
    const mode = useWalletStore.getState().mode;
    const adapter = mode === "mock" ? mockWalletAdapter : realWalletAdapter;
    if (!adapter.isConnected()) throw new Error("signing_failed: not connected");
    const rec = await adapter.signMessage(message, "readiness_statement");
    useWalletStore.getState().patch({
      signatureHistory: [...useWalletStore.getState().signatureHistory, rec].slice(-50),
    });
    if (adapter.getSession()) writePersistedSession(adapter.getSession()!);
  },

  async signMessage(message: string, purpose: SignaturePurpose = "generic"): Promise<void> {
    const mode = useWalletStore.getState().mode;
    const adapter = mode === "mock" ? mockWalletAdapter : realWalletAdapter;
    if (!adapter.isConnected()) throw new Error("signing_failed: not connected");
    const rec = await adapter.signMessage(message, purpose);
    useWalletStore.getState().patch({
      signatureHistory: [...useWalletStore.getState().signatureHistory, rec].slice(-50),
    });
    const s = adapter.getSession();
    if (s) writePersistedSession(s);
  },

  async signTypedData(payload: TypedDataPayload, purpose: SignaturePurpose = "reward_manifest"): Promise<void> {
    const mode = useWalletStore.getState().mode;
    const adapter = mode === "mock" ? mockWalletAdapter : realWalletAdapter;
    if (!adapter.isConnected()) throw new Error("signing_failed: not connected");
    const rec = await adapter.signTypedData(payload, purpose);
    useWalletStore.getState().patch({
      signatureHistory: [...useWalletStore.getState().signatureHistory, rec].slice(-50),
    });
    const s = adapter.getSession();
    if (s) writePersistedSession(s);
  },

  async sendDemoTransaction(to: `0x${string}`): Promise<void> {
    const mode = useWalletStore.getState().mode;
    const adapter = mode === "mock" ? mockWalletAdapter : realWalletAdapter;
    if (!adapter.isConnected()) throw new Error("signing_failed: not connected");
    const rec = await adapter.sendTransaction({ to, value: 0n });
    useWalletStore.getState().patch({
      transactionHistory: [...useWalletStore.getState().transactionHistory, rec].slice(-50),
    });
    const s = adapter.getSession();
    if (s) writePersistedSession(s);
  },

  resetDemoIdentity(): void {
    const seed = `tashi-demo-${globalThis.crypto?.randomUUID?.() ?? String(Date.now())}`;
    mockWalletAdapter.setDemoSeed(seed);
    useWalletStore.getState().patch({ demoSeed: seed });
  },

  clearStaleRealSession(): void {
    clearPersistedSession();
    useWalletStore.getState().patch({
      session: null,
      sessionRestoreStatus: "idle",
      error: null,
    });
  },

  /** For tests */
  async _resetAdapters(): Promise<void> {
    await mockWalletAdapter.disconnect().catch(() => {});
    realWalletAdapter.bindRuntime(null);
  },
};
