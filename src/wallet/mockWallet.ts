import {
  DEFAULT_DEMO_PERSONA_ID,
  DEMO_NETWORK_LABELS,
  type DemoNetworkId,
  getDemoPersonaById,
} from "@/wallet/demoPersonas";
import { demoAddressFromSeed, mockSignatureHex, mockTxHash, mockTypedDataSignature } from "@/wallet/signing";
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

const MOCK_LATENCY_MS = { min: 120, max: 520 };

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function demoDelay(): Promise<void> {
  const span = MOCK_LATENCY_MS.max - MOCK_LATENCY_MS.min;
  const ms = MOCK_LATENCY_MS.min + Math.floor(Math.random() * span);
  await sleep(ms);
}

function newId(prefix: string): string {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? String(Date.now())}`;
}

function newRestoreToken(): string {
  const bytes = new Uint8Array(24);
  globalThis.crypto?.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export class MockWalletAdapter implements WalletAdapter {
  readonly id = "mock-wallet";
  readonly isMock = true;

  private connected = false;
  private personaId = DEFAULT_DEMO_PERSONA_ID;
  private networkId: DemoNetworkId = "vertex-demo-network";
  private demoSeed = "tashi-hackathon-demo-seed";
  private session: WalletSession | null = null;
  private sigCount = 0;
  private txCount = 0;

  setDemoSeed(seed: string): void {
    this.demoSeed = seed;
  }

  getDemoSeed(): string {
    return this.demoSeed;
  }

  setPersona(personaId: string): void {
    if (!getDemoPersonaById(personaId)) throw new Error("mock_misconfigured: unknown persona");
    this.personaId = personaId;
  }

  getPersonaId(): string {
    return this.personaId;
  }

  setNetwork(networkId: DemoNetworkId): void {
    this.networkId = networkId;
  }

  getNetworkId(): DemoNetworkId {
    return this.networkId;
  }

  async connect(): Promise<void> {
    await demoDelay();
    const persona = getDemoPersonaById(this.personaId);
    if (!persona) throw new Error("mock_misconfigured: persona");
    const now = Date.now();
    this.session = {
      sessionId: globalThis.crypto?.randomUUID?.() ?? `sess-${now}`,
      accountAddress: await this.computeAddress(),
      providerType: "mock",
      demoMode: true,
      chainLabel: DEMO_NETWORK_LABELS[this.networkId],
      chainId: null,
      personaId: persona.id,
      expirationMs: now + 7 * 24 * 60 * 60 * 1000,
      restoreToken: newRestoreToken(),
      lastActionAt: now,
      signatureCount: this.sigCount,
      transactionCount: this.txCount,
      demoSeed: this.demoSeed,
    };
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    await demoDelay();
    this.connected = false;
    this.session = null;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async restoreSession(session: WalletSession): Promise<boolean> {
    if (!session.demoMode) return false;
    if (Date.now() > session.expirationMs) return false;
    const personaId = session.personaId ?? DEFAULT_DEMO_PERSONA_ID;
    if (!getDemoPersonaById(personaId)) return false;
    this.personaId = personaId;
    this.demoSeed = session.demoSeed;
    this.sigCount = session.signatureCount;
    this.txCount = session.transactionCount;
    const addr = await this.computeAddress();
    if (addr.toLowerCase() !== session.accountAddress.toLowerCase()) return false;
    this.session = { ...session, lastActionAt: Date.now() };
    this.connected = true;
    return true;
  }

  getAccount(): WalletAccount | null {
    if (!this.connected || !this.session) return null;
    const persona = getDemoPersonaById(this.personaId);
    if (!persona) return null;
    const now = Date.now();
    return {
      address: this.session.accountAddress as `0x${string}`,
      displayName: persona.name,
      providerType: "mock",
      persona,
      chainId: null,
      chainLabel: DEMO_NETWORK_LABELS[this.networkId],
      connectedAt: this.session.lastActionAt,
      lastSeenAt: now,
      isMock: true,
      metadata: {
        role: persona.roleLabel,
        networkKey: this.networkId,
        recommendedMissionRole: persona.recommendedMissionRole,
      },
      permissionsGranted: ["mission_signing", "settlement_preview", "reward_manifest"],
    };
  }

  getNetwork(): { chainId: number | null; label: string } {
    return { chainId: null, label: DEMO_NETWORK_LABELS[this.networkId] };
  }

  getSession(): WalletSession | null {
    return this.session;
  }

  async signMessage(message: string, purpose: SignaturePurpose): Promise<SignatureRecord> {
    await demoDelay();
    if (!this.connected) throw new Error("signing_failed: not connected");
    const persona = getDemoPersonaById(this.personaId);
    if (!persona) throw new Error("mock_misconfigured: persona");
    this.sigCount += 1;
    if (this.session) {
      this.session.signatureCount = this.sigCount;
      this.session.lastActionAt = Date.now();
    }
    const sig = await mockSignatureHex({
      message,
      personaSeed: `${persona.addressSeed}|${this.demoSeed}`,
      purpose,
      simulated: true,
    });
    return {
      id: newId("sig"),
      signedMessage: message,
      signature: sig,
      timestamp: Date.now(),
      purpose,
      status: "confirmed",
      simulated: true,
    };
  }

  async signTypedData(payload: TypedDataPayload, purpose: SignaturePurpose): Promise<SignatureRecord> {
    await demoDelay();
    if (!this.connected) throw new Error("signing_failed: not connected");
    const persona = getDemoPersonaById(this.personaId);
    if (!persona) throw new Error("mock_misconfigured: persona");
    this.sigCount += 1;
    if (this.session) {
      this.session.signatureCount = this.sigCount;
      this.session.lastActionAt = Date.now();
    }
    const sig = await mockTypedDataSignature(payload, `${persona.addressSeed}|${this.demoSeed}`);
    const message = JSON.stringify({ primaryType: payload.primaryType, message: payload.message });
    return {
      id: newId("sig"),
      signedMessage: message,
      signature: sig,
      timestamp: Date.now(),
      purpose,
      status: "confirmed",
      simulated: true,
    };
  }

  async sendTransaction(tx: SendTransactionInput): Promise<TransactionRecord> {
    await demoDelay();
    if (!this.connected) throw new Error("signing_failed: not connected");
    const persona = getDemoPersonaById(this.personaId);
    if (!persona) throw new Error("mock_misconfigured: persona");
    this.txCount += 1;
    if (this.session) {
      this.session.transactionCount = this.txCount;
      this.session.lastActionAt = Date.now();
    }
    const payload = JSON.stringify({ to: tx.to, value: tx.value?.toString() ?? "0", data: tx.data ?? "0x" });
    const hash = await mockTxHash({
      fromSeed: `${persona.addressSeed}|${this.demoSeed}`,
      to: tx.to,
      payload,
    });
    return {
      id: newId("tx"),
      txHash: hash,
      destination: tx.to,
      amountOrPayload: payload,
      status: "simulated",
      receipt: {
        status: "simulated",
        blockNumber: "demo-block",
        confirmations: 0,
        note: "Simulated transaction — no chain broadcast",
      },
      timestamp: Date.now(),
      simulated: true,
    };
  }

  async refreshAccountAfterPersonaSwitch(): Promise<void> {
    if (!this.connected || !this.session) return;
    const addr = await this.computeAddress();
    this.session.accountAddress = addr;
    this.session.personaId = this.personaId;
    this.session.lastActionAt = Date.now();
  }

  private async computeAddress(): Promise<string> {
    return demoAddressFromSeed({
      personaId: this.personaId,
      globalDemoSeed: this.demoSeed,
      networkId: this.networkId,
    });
  }
}
