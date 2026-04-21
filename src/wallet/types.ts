import type { DemoPersona } from "@/wallet/demoPersonas";

export type WalletMode = "disconnected" | "mock" | "real";

export type WalletConnectionStatus =
  | "idle"
  | "restoring"
  | "connecting"
  | "connected"
  | "disconnecting"
  | "error";

export type WalletProviderKind = "mock" | "injected";

export type WalletErrorCode =
  | "provider_not_found"
  | "connection_rejected"
  | "invalid_session"
  | "stale_session"
  | "unsupported_network"
  | "signing_failed"
  | "mock_misconfigured"
  | "settlement_unavailable"
  | "unknown";

export interface WalletAccount {
  address: `0x${string}` | string;
  displayName: string;
  providerType: WalletProviderKind | "external";
  persona: DemoPersona | null;
  chainId: number | null;
  chainLabel: string;
  connectedAt: number;
  lastSeenAt: number;
  isMock: boolean;
  metadata: Record<string, string | number | boolean>;
  permissionsGranted: string[];
}

export interface WalletSession {
  sessionId: string;
  accountAddress: string;
  providerType: WalletProviderKind | "external";
  demoMode: boolean;
  chainLabel: string;
  chainId: number | null;
  personaId: string | null;
  expirationMs: number;
  restoreToken: string;
  lastActionAt: number;
  signatureCount: number;
  transactionCount: number;
  demoSeed: string;
  /** Browser wallet connector label when provider is injected */
  connectorLabel?: string | null;
}

export type SignaturePurpose =
  | "mission_check_in"
  | "readiness_statement"
  | "settlement_payload"
  | "reward_manifest"
  | "generic";

export interface SignatureRecord {
  id: string;
  signedMessage: string;
  signature: string;
  timestamp: number;
  purpose: SignaturePurpose;
  status: "confirmed" | "rejected" | "pending";
  simulated: boolean;
}

export type TransactionStatus = "submitted" | "confirmed" | "failed" | "simulated";

export interface TransactionRecord {
  id: string;
  txHash: string;
  destination: string;
  amountOrPayload: string;
  status: TransactionStatus;
  receipt: Record<string, unknown> | null;
  timestamp: number;
  simulated: boolean;
}

export interface TypedDataPayload {
  domain: Record<string, unknown>;
  types: Record<string, Array<{ name: string; type: string }>>;
  primaryType: string;
  message: Record<string, unknown>;
}

export interface SendTransactionInput {
  to: `0x${string}`;
  value?: bigint;
  data?: `0x${string}`;
}

export interface WalletAdapterSessionSnapshot {
  account: WalletAccount | null;
  chainId: number | null;
  chainLabel: string;
}

/**
 * Shared contract for mock and real wallet backends.
 * Real implementations may delegate to wagmi / WalletConnect once wired.
 */
export interface WalletAdapter {
  readonly id: string;
  readonly isMock: boolean;

  connect(params?: Record<string, unknown>): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  getAccount(): WalletAccount | null;
  getNetwork(): { chainId: number | null; label: string };
  getSession(): WalletSession | null;
  restoreSession(session: WalletSession): Promise<boolean>;
  signMessage(message: string, purpose: SignaturePurpose): Promise<SignatureRecord>;
  signTypedData(payload: TypedDataPayload, purpose: SignaturePurpose): Promise<SignatureRecord>;
  sendTransaction(tx: SendTransactionInput): Promise<TransactionRecord>;
}

export interface SettlementPreviewInput {
  missionId: string;
  arcPayloadHash: string;
  terminalHash: string;
  rewardManifestSummary: string;
  operatorDisplay: string;
  operatorAddress: string;
}

export interface SettlementPreview {
  artifactId: string;
  payloadJson: string;
  payloadHash: string;
  operatorAddress: string;
  simulated: boolean;
  signedAt: number | null;
  mockReceipt: Record<string, unknown> | null;
}
