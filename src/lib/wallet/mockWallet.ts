import { keccak256, stringToBytes } from "viem";

const DEMO_ADDR = "0xDemo000000000000000000000000000000000001";

export function deterministicDemoAddress(seed: string): `0x${string}` {
  const h = keccak256(stringToBytes(`tashi-demo|${seed}`));
  return (`0x${h.slice(2, 42)}` as `0x${string}`) || (DEMO_ADDR as `0x${string}`);
}

export const MOCK_WALLET_CHAIN_ID = 11155111; // Sepolia (label only for demo)

export function mockSignPayload(label: string): string {
  const h = keccak256(stringToBytes(`mock-sign|${label}|${Date.now()}`));
  return h.slice(0, 18);
}
