import type { Address } from "viem";

const ZERO = "0x0000000000000000000000000000000000000000" as const;

function parseAddress(value: string | undefined): Address | undefined {
  if (!value || !/^0x[a-fA-F0-9]{40}$/.test(value) || value.toLowerCase() === ZERO.toLowerCase()) {
    return undefined;
  }
  return value as Address;
}

/** Set `VITE_STAKING_CONTRACT_ADDRESS` when the staking contract is deployed. */
export const STAKING_ADDRESS = parseAddress(import.meta.env.VITE_STAKING_CONTRACT_ADDRESS);

/** Optional ERC-20 $TASHI for wallet balance reads (`balanceOf`). */
export const TASHI_TOKEN_ADDRESS = parseAddress(import.meta.env.VITE_TASHI_TOKEN_ADDRESS);

export const STAKING_ABI = [
  {
    type: "function",
    name: "stakedOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "pendingRewards",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "totalStaked",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "stake",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "unstake",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "claimRewards",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
] as const;

export const ERC20_BALANCE_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;
