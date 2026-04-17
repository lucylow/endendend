export interface StakingContextValue {
  stakedBalance: number;
  unclaimedRewards: number;
  totalRewardsEarned: number;
  totalStaked: number;
  apy: number;
  walletBalance: number;
  maxStake: number;
  stake: (amount: number) => Promise<void>;
  unstake: (amount: number) => Promise<void>;
  claimRewards: () => Promise<void>;
  isStaking: boolean;
  isUnstaking: boolean;
  isClaiming: boolean;
  claimCooldown: number;
  isWalletConnected: boolean;
  isContractConfigured: boolean;
  isMockMode: boolean;
  /** RPC / contract read failure while live mode is active (empty when mock or no wallet). */
  chainReadError: string | null;
  /** Set when waiting for `hash` fails (dropped tx, RPC timeout, etc.). */
  receiptError: string | null;
}
