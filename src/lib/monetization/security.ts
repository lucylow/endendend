/**
 * Policy constants and helpers for monetized swarm coordination — sales, metering UI, and ops runbooks.
 * Not legal or certification advice; align production controls with your auditor and insurer.
 */

export const MONETIZATION_SECURITY = {
  /** Cleared settlements above this notional require operator multi-sig (e.g. 2-of-3) before Arc execution. */
  settlementMultiSigThresholdUsd: 1000,
  /** Policy line for Strong Customer Authentication (3DS) — Stripe applies SCA when regulations require; document the floor. */
  scaStepUpMinUsd: 50,
  /** Sybil resistance: minimum stake weight for voting / priority (matches staking.ts narrative). */
  minStakeSybilTashi: 10_000,
  consensusLatencyWarnMs: 100,
  consensusLatencyCriticalMs: 200,
  rootKeyRotationDays: 90,
  protocolUpgradeTimelockHours: 48,
  /** Automatic slash factor for malicious or provably Byzantine behavior (policy; on-chain enforcement separate). */
  maliciousStakeSlashFraction: 0.1,
  droneEmergencyWatchdogMs: 500,
  swarmFaultToleranceFraction: 0.4,
} as const;

export function settlementRequiresMultiSig(dealValueUsd: number): boolean {
  if (!Number.isFinite(dealValueUsd) || dealValueUsd < 0) return false;
  return dealValueUsd >= MONETIZATION_SECURITY.settlementMultiSigThresholdUsd;
}

export function consensusSeverityFromLatencyMs(latencyMs: number): "ok" | "warn" | "critical" {
  if (!Number.isFinite(latencyMs) || latencyMs < 0) return "ok";
  if (latencyMs >= MONETIZATION_SECURITY.consensusLatencyCriticalMs) return "critical";
  if (latencyMs >= MONETIZATION_SECURITY.consensusLatencyWarnMs) return "warn";
  return "ok";
}

export type AuditSeverity = "critical" | "high" | "medium" | "ops";

export type AuditImplementation = "in_repo" | "partial" | "policy";

export interface SecurityAuditItem {
  id: string;
  title: string;
  detail: string;
  severity: AuditSeverity;
  implementation: AuditImplementation;
}

export interface SecurityAuditPhase {
  id: string;
  title: string;
  subtitle: string;
  items: SecurityAuditItem[];
}

export const MONETIZATION_SECURITY_AUDIT: SecurityAuditPhase[] = [
  {
    id: "prelaunch",
    title: "Pre-launch audit",
    subtitle: "Gate: no production until consensus, crypto, and contract controls are signed off.",
    items: [
      {
        id: "bft",
        title: "Byzantine fault tolerance",
        detail:
          "Simulate ~33% malicious or partitioned nodes; swarm maintains valid chain and task ordering. Target sub-100ms BFT windows where hardware and RF allow — cite measured p50/p99 in customer docs.",
        severity: "critical",
        implementation: "partial",
      },
      {
        id: "double_spend",
        title: "Double-spend and replay protection",
        detail:
          "Task auctions cannot commit the same bid twice; nonces plus bounded timestamps on every CoordinationPermit and bid message.",
        severity: "critical",
        implementation: "policy",
      },
      {
        id: "ordering",
        title: "Front-running and ordering fairness",
        detail:
          "Consensus ordering defines bid inclusion; no separate public mempool MEV lane for task bids. Document policy for any priority queue vs. stake weight.",
        severity: "high",
        implementation: "policy",
      },
      {
        id: "sybil",
        title: "Sybil resistance",
        detail:
          `Stake-weighted voting and priority require minimum ${MONETIZATION_SECURITY.minStakeSybilTashi.toLocaleString("en-US")} $TASHI; pair with proof-of-coordination or hardware-bound agent identity where feasible.`,
        severity: "high",
        implementation: "partial",
      },
      {
        id: "zk",
        title: "Privacy-preserving telemetry",
        detail:
          "Battery, health, and coarse position attestable without revealing exact coordinates where missions require it (ZK or Arc privacy layer).",
        severity: "medium",
        implementation: "policy",
      },
      {
        id: "keys",
        title: "Key hierarchy and rotation",
        detail:
          `Ed25519 (or successor) agent keys; root keys in HSM; rotation at least every ${MONETIZATION_SECURITY.rootKeyRotationDays} days. Permits cryptographically bound to agent identity.`,
        severity: "critical",
        implementation: "policy",
      },
      {
        id: "multisig",
        title: "Settlement multi-sig",
        detail: `Arc or bridge settlements at or above $${MONETIZATION_SECURITY.settlementMultiSigThresholdUsd.toLocaleString("en-US")} notional require 2-of-3 swarm operator approval before execution.`,
        severity: "critical",
        implementation: "policy",
      },
      {
        id: "contracts",
        title: "Smart contract and bridge controls",
        detail:
          "External audit (Slither, Mythril, manual); emergency pause for all swarms; 48h timelock on protocol upgrades; slashing enforced for provable malicious behavior.",
        severity: "critical",
        implementation: "policy",
      },
      {
        id: "pqc",
        title: "Post-quantum readiness",
        detail: "Roadmap to migrate permit and settlement signing to hybrid classical + PQ (e.g. Dilithium) by end of 2026.",
        severity: "medium",
        implementation: "policy",
      },
    ],
  },
  {
    id: "deployment",
    title: "Deployment checklist",
    subtitle: "Physical safety first, then network and payment rails.",
    items: [
      {
        id: "failsafe",
        title: "Swarm fail-safes",
        detail:
          "Per-drone watchdog and emergency stop; collision avoidance in GPS-denied conditions; geofencing and human proximity warnings; containment and auto-recall on boundary breach.",
        severity: "critical",
        implementation: "partial",
      },
      {
        id: "fault_tol",
        title: "Swarm fault tolerance",
        detail:
          "Documented behavior with up to ~40% node loss; aligns with relay and mesh routing tests in simulation.",
        severity: "high",
        implementation: "partial",
      },
      {
        id: "network",
        title: "Network hardening",
        detail:
          "TLS 1.3 with mutual auth and pinning where applicable; rate limiting and DDoS posture; zero-trust verification of message signatures; signed OTA with rollback.",
        severity: "high",
        implementation: "policy",
      },
      {
        id: "stripe",
        title: "Card payments (Stripe)",
        detail: `Strong Customer Authentication: banks and Stripe trigger 3DS when required; policy documents step-up for card payments over $${MONETIZATION_SECURITY.scaStepUpMinUsd} where you commit to extra friction.`,
        severity: "high",
        implementation: "partial",
      },
      {
        id: "bridge",
        title: "Lattice → Arc settlement",
        detail: "Bridge paths audited; multi-sig and pause aligned with contract section; invoices and receipts hashed and signed for tamper evidence.",
        severity: "critical",
        implementation: "policy",
      },
    ],
  },
  {
    id: "runtime",
    title: "Runtime monitoring",
    subtitle: "24/7 SOC-style visibility for coordination, bids, stake, and physical anomalies.",
    items: [
      {
        id: "latency",
        title: "Consensus and coordination drift",
        detail: `Alert when ordering latency exceeds ${MONETIZATION_SECURITY.consensusLatencyWarnMs}ms sustained; critical incident playbook above ${MONETIZATION_SECURITY.consensusLatencyCriticalMs}ms.`,
        severity: "critical",
        implementation: "policy",
      },
      {
        id: "bids",
        title: "Bid and telemetry anomalies",
        detail:
          "Detect impossible bids (e.g. battery vs. flight time), flash-loan-style stake spikes, and unusual auction patterns; throttle spam bids with rate limits.",
        severity: "high",
        implementation: "policy",
      },
      {
        id: "logs",
        title: "Logging and forensics",
        detail:
          "Immutable append-only coordination logs with retention and legal hold; multi-region Vertex or broker redundancy targeting 99.99% availability for control plane.",
        severity: "high",
        implementation: "policy",
      },
      {
        id: "chaos",
        title: "Chaos and red team",
        detail: "Weekly fault injection and periodic red-team exercises; results feed back into slashing and pause policies.",
        severity: "ops",
        implementation: "policy",
      },
    ],
  },
  {
    id: "incident",
    title: "Incident response and compliance",
    subtitle: "Quarterly tabletops; regulator and insurer artifacts.",
    items: [
      {
        id: "ir",
        title: "Playbooks",
        detail:
          "Consensus attack, physical collision, payment fraud, and DDoS: detection, containment, recovery, post-mortem. Tie Stripe webhooks to account freeze and refund flows.",
        severity: "high",
        implementation: "partial",
      },
      {
        id: "compliance",
        title: "Compliance and insurance",
        detail:
          "FAA Part 107 (or successor) where applicable; OSHA robotics for warehouse; SOC 2 Type II for financial controls; liability coverage sized to fleet risk; GDPR/CCPA for position and PII minimization.",
        severity: "ops",
        implementation: "policy",
      },
    ],
  },
];

export const ATTACK_SURFACE_PRIORITY: {
  rank: number;
  title: string;
  severity: AuditSeverity;
  mitigation: string;
}[] = [
  { rank: 1, title: "Consensus ordering manipulation", severity: "critical", mitigation: "Stake slashing + pause" },
  { rank: 2, title: "Fake agent identity", severity: "critical", mitigation: "Permit signature verification + hardware attestation" },
  { rank: 3, title: "Physical takeover", severity: "critical", mitigation: "Secure boot + tamper detection" },
  { rank: 4, title: "Bridge or settlement exploit", severity: "critical", mitigation: "Multi-sig + emergency pause" },
  { rank: 5, title: "Bid front-running", severity: "high", mitigation: "BFT ordering + transparent priority rules" },
  { rank: 6, title: "DDoS on mesh or API", severity: "high", mitigation: "Lattice redundancy + edge protection" },
  { rank: 7, title: "Key compromise", severity: "high", mitigation: "HSM + rotation + revocation" },
  { rank: 8, title: "Spam bids / DoS", severity: "medium", mitigation: "Rate limits + stake or fee gates" },
  { rank: 9, title: "Privacy leak", severity: "medium", mitigation: "ZK or aggregated telemetry" },
];
