import { sha256Hex, stableStringify } from "@/backend/vertex/hash-chain";
import type { SignaturePurpose, TypedDataPayload } from "@/wallet/types";

function randomNonce(): string {
  const a = new Uint8Array(8);
  globalThis.crypto?.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function mockSignatureHex(input: {
  message: string;
  personaSeed: string;
  purpose: SignaturePurpose;
  simulated: true;
}): Promise<string> {
  const body = stableStringify({
    kind: "tashi-mock-sig-v1",
    simulated: input.simulated,
    purpose: input.purpose,
    personaSeed: input.personaSeed,
    message: input.message,
    nonce: randomNonce(),
  });
  const digest = await sha256Hex(body);
  return `0xmock${digest}` as const;
}

export async function mockTypedDataSignature(payload: TypedDataPayload, personaSeed: string): Promise<string> {
  const canonical = stableStringify({ payload, personaSeed, kind: "tashi-mock-eip712-ish-v1" });
  const digest = await sha256Hex(canonical);
  return `0xmocktyped${digest}`;
}

export async function mockTxHash(input: {
  fromSeed: string;
  to: string;
  payload: string;
}): Promise<string> {
  const digest = await sha256Hex(
    stableStringify({
      kind: "tashi-mock-tx-v1",
      fromSeed: input.fromSeed,
      to: input.to,
      payload: input.payload,
    }),
  );
  return `0x${digest}`;
}

export async function demoAddressFromSeed(parts: {
  personaId: string;
  globalDemoSeed: string;
  networkId: string;
}): Promise<`0x${string}`> {
  const digest = await sha256Hex(
    stableStringify({
      kind: "tashi-demo-address-v1",
      personaId: parts.personaId,
      seed: parts.globalDemoSeed,
      networkId: parts.networkId,
    }),
  );
  return (`0x${digest.slice(0, 40)}` as `0x${string}`);
}
