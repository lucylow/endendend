import { sha256Hex, stableStringify } from "@/backend/vertex/hash-chain";
import type { MissionOutcomePacket } from "@/backend/arc/mission-outcome";
import type { MockWalletAdapter } from "@/wallet/mockWallet";
import type { SettlementPreview, SettlementPreviewInput, WalletAccount } from "@/wallet/types";
import { mockSignatureHex } from "@/wallet/signing";

export function operatorIdentityFromWallet(account: WalletAccount | null): {
  operatorId: string;
  displayLabel: string;
  settlementRecipient: string;
  isMock: boolean;
} | null {
  if (!account) return null;
  return {
    operatorId: account.address,
    displayLabel: account.persona ? `${account.persona.name} · ${account.persona.roleLabel}` : account.displayName,
    settlementRecipient: account.address,
    isMock: account.isMock,
  };
}

export async function buildSettlementPreview(input: SettlementPreviewInput, simulated: boolean): Promise<SettlementPreview> {
  const payload = {
    kind: "arc-settlement-preview-v1",
    missionId: input.missionId,
    arcPayloadHash: input.arcPayloadHash,
    terminalHash: input.terminalHash,
    rewardManifestSummary: input.rewardManifestSummary,
    operator: {
      address: input.operatorAddress,
      label: input.operatorDisplay,
    },
    simulated,
  };
  const payloadJson = stableStringify(payload);
  const payloadHash = await sha256Hex(payloadJson);
  return {
    artifactId: `arc-preview-${input.missionId}`,
    payloadJson,
    payloadHash,
    operatorAddress: input.operatorAddress,
    simulated,
    signedAt: null,
    mockReceipt: null,
  };
}

export async function signSettlementPreviewWithMockWallet(
  adapter: MockWalletAdapter,
  preview: SettlementPreview,
): Promise<SettlementPreview> {
  const persona = adapter.getPersonaId();
  const seed = adapter.getDemoSeed();
  const sig = await mockSignatureHex({
    message: preview.payloadHash,
    personaSeed: `${persona}|${seed}`,
    purpose: "settlement_payload",
    simulated: true,
  });
  return {
    ...preview,
    signedAt: Date.now(),
    mockReceipt: {
      signature: sig,
      simulated: true,
      note: "Mock settlement attestation — not a live chain proof",
      artifactId: preview.artifactId,
      payloadHash: preview.payloadHash,
    },
  };
}

/** Judge-safe sample outcome for UI demos when no Vertex ledger is attached. */
export function buildDemoOutcomePacket(missionId: string): MissionOutcomePacket {
  const h = (c: string) => c.repeat(64);
  return {
    missionId,
    terminalHash: h("a"),
    checkpointHash: h("b"),
    arcPayloadHash: h("c"),
    executiveSummary: {
      scenario: "collapsed_building",
      durationMinutes: 42,
      targetsFound: 3,
      extractions: 2,
      coveragePercent: 78,
      safetyIncidents: 0,
      totalRewardPool: "12,500 DEMO",
      status: "success",
    },
    ledgerProof: {
      eventCount: 48,
      consensusEvents: 11,
      tailEventType: "phase_transition",
    },
    latticeValidation: {
      finalNodeCount: 8,
      avgReputation: 0.91,
      trustViolations: 0,
    },
    contributions: [
      {
        nodeId: "uav-1",
        roleSummary: "explorer: LIDAR sweep + victim fix",
        keyProofs: [h("d").slice(0, 18), h("e").slice(0, 18)],
        rewardEarned: "4200 DEMO",
      },
    ],
    settlementReady: true,
    chainTargets: [
      { chain: "ethereum", payloadSize: 2048, estimatedGas: 175_000 },
      { chain: "hedera", payloadSize: 2048, estimatedGas: 155_000 },
    ],
    replayVerified: true,
    operatorNotes: [
      "Demo-only outcome packet for Arc settlement preview wiring.",
      "Replace with `buildMissionOutcomePacket` when bound to a live mission ledger.",
    ],
  };
}

export function missionOutcomeToSettlementInput(
  packet: MissionOutcomePacket,
  operator: WalletAccount,
): SettlementPreviewInput {
  const rewardSummary = `${packet.executiveSummary.status} · pool ${packet.executiveSummary.totalRewardPool} · ${packet.contributions.length} contributions`;
  const opLabel = operator.persona
    ? `${operator.persona.name} (${operator.persona.roleLabel})`
    : operator.displayName;
  return {
    missionId: packet.missionId,
    arcPayloadHash: packet.arcPayloadHash,
    terminalHash: packet.terminalHash,
    rewardManifestSummary: rewardSummary,
    operatorAddress: operator.address,
    operatorDisplay: opLabel,
  };
}
