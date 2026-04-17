import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { formatEther, parseEther } from "viem";
import {
  ERC20_BALANCE_ABI,
  STAKING_ABI,
  STAKING_ADDRESS,
  TASHI_TOKEN_ADDRESS,
} from "./StakingContract";
import type { StakingContextValue } from "./types";
import { toast } from "sonner";

const StakingContext = createContext<StakingContextValue | null>(null);

function stakingTxErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "Transaction failed";
}

const LIFETIME_KEY = "tashi_staking_lifetime_rewards";
const DISPLAY_APY = Number(import.meta.env.VITE_DISPLAY_APY ?? "48.2");
const MAX_STAKE_CAP = 1_000_000;

const MOCK = {
  stakedBalance: 25_000,
  unclaimedRewards: 125.42,
  totalStaked: 12_450_000,
  apy: DISPLAY_APY,
  walletBalance: 42_180.55,
  totalRewardsEarned: 18_920,
};

function loadLifetime(): number {
  try {
    const raw = localStorage.getItem(LIFETIME_KEY);
    if (raw == null) return MOCK.totalRewardsEarned;
    const n = Number(raw);
    return Number.isFinite(n) ? n : MOCK.totalRewardsEarned;
  } catch {
    return MOCK.totalRewardsEarned;
  }
}

function saveLifetime(n: number) {
  try {
    localStorage.setItem(LIFETIME_KEY, String(n));
  } catch {
    /* ignore */
  }
}

export function StakingProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { address, isConnected } = useAccount();
  const contractReady = Boolean(STAKING_ADDRESS);
  const demoNoWallet = import.meta.env.DEV && !isConnected;
  const isMockMode = demoNoWallet || !contractReady;

  const [mockStaked, setMockStaked] = useState(MOCK.stakedBalance);
  const [mockUnclaimed, setMockUnclaimed] = useState(MOCK.unclaimedRewards);
  const [mockWallet, setMockWallet] = useState(MOCK.walletBalance);
  const [mockTotalStaked, setMockTotalStaked] = useState(MOCK.totalStaked);
  const [lifetimeEarned, setLifetimeEarned] = useState(loadLifetime);
  const [claimCooldown, setClaimCooldown] = useState(0);
  const [txKind, setTxKind] = useState<"stake" | "unstake" | "claim" | null>(null);

  const { writeContractAsync, isPending: isWritePending } = useWriteContract();
  const [hash, setHash] = useState<`0x${string}` | undefined>();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });
  const claimAmountRef = useRef(0);
  const completedOpRef = useRef<"stake" | "unstake" | "claim" | null>(null);
  const processedReceiptRef = useRef<`0x${string}` | undefined>(undefined);

  const enabledReads = Boolean(contractReady && isConnected && address && !demoNoWallet);

  const { data: stakedRaw } = useReadContract({
    address: STAKING_ADDRESS,
    abi: STAKING_ABI,
    functionName: "stakedOf",
    args: address ? [address] : undefined,
    query: { enabled: enabledReads },
  });

  const { data: pendingRaw } = useReadContract({
    address: STAKING_ADDRESS,
    abi: STAKING_ABI,
    functionName: "pendingRewards",
    args: address ? [address] : undefined,
    query: { enabled: enabledReads },
  });

  const { data: totalStakedRaw } = useReadContract({
    address: STAKING_ADDRESS,
    abi: STAKING_ABI,
    functionName: "totalStaked",
    query: { enabled: contractReady },
  });

  const { data: walletTokenRaw } = useReadContract({
    address: TASHI_TOKEN_ADDRESS,
    abi: ERC20_BALANCE_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(TASHI_TOKEN_ADDRESS && isConnected && address && !demoNoWallet) },
  });

  useEffect(() => {
    if (!isConfirmed || !hash) return;
    if (processedReceiptRef.current === hash) return;
    processedReceiptRef.current = hash;

    if (completedOpRef.current === "claim" && claimAmountRef.current > 0) {
      const amt = claimAmountRef.current;
      claimAmountRef.current = 0;
      setLifetimeEarned((e) => {
        const next = e + amt;
        saveLifetime(next);
        return next;
      });
    }
    completedOpRef.current = null;
    setTxKind(null);
    setHash(undefined);
    void queryClient.invalidateQueries();
  }, [isConfirmed, hash, queryClient]);

  const txBusy = isWritePending || isConfirming;
  const isStaking = txKind === "stake" && txBusy;
  const isUnstaking = txKind === "unstake" && txBusy;
  const isClaiming = txKind === "claim" && txBusy;

  useEffect(() => {
    if (claimCooldown <= 0) return;
    const t = window.setInterval(() => {
      setClaimCooldown((s) => Math.max(0, s - 1));
    }, 1000);
    return () => window.clearInterval(t);
  }, [claimCooldown]);

  const stakedBalance = useMemo(() => {
    if (demoNoWallet) return mockStaked;
    if (!isConnected) return 0;
    if (!contractReady) return mockStaked;
    if (stakedRaw == null) return 0;
    return Number(formatEther(stakedRaw as bigint));
  }, [demoNoWallet, isConnected, contractReady, mockStaked, stakedRaw]);

  const unclaimedRewards = useMemo(() => {
    if (demoNoWallet) return mockUnclaimed;
    if (!isConnected) return 0;
    if (!contractReady) return mockUnclaimed;
    if (pendingRaw == null) return 0;
    return Number(formatEther(pendingRaw as bigint));
  }, [demoNoWallet, isConnected, contractReady, mockUnclaimed, pendingRaw]);

  const totalStaked = useMemo(() => {
    if (contractReady && totalStakedRaw != null) {
      return Number(formatEther(totalStakedRaw as bigint));
    }
    if (demoNoWallet || (isConnected && !contractReady)) return mockTotalStaked;
    return 0;
  }, [contractReady, totalStakedRaw, demoNoWallet, isConnected, mockTotalStaked]);

  const walletBalance = useMemo(() => {
    if (demoNoWallet) return MOCK.walletBalance;
    if (!isConnected) return 0;
    if (!contractReady) return mockWallet;
    if (TASHI_TOKEN_ADDRESS && walletTokenRaw != null) {
      return Number(formatEther(walletTokenRaw as bigint));
    }
    return mockWallet;
  }, [demoNoWallet, isConnected, contractReady, mockWallet, walletTokenRaw]);

  const apy = DISPLAY_APY;

  const stake = useCallback(
    async (amount: number) => {
      if (!amount || amount <= 0) return;
      if (!isConnected && !demoNoWallet) return;
      if (demoNoWallet || !contractReady) {
        setMockStaked((s) => s + amount);
        setMockWallet((w) => Math.max(0, w - amount));
        setMockTotalStaked((t) => t + amount);
        return;
      }
      if (!STAKING_ADDRESS || !address) return;
      setTxKind("stake");
      completedOpRef.current = "stake";
      try {
        const h = await writeContractAsync({
          address: STAKING_ADDRESS!,
          abi: STAKING_ABI,
          functionName: "stake",
          args: [parseEther(String(amount))],
          account: address!,
        });
        setHash(h);
      } catch (err) {
        completedOpRef.current = null;
        setTxKind(null);
        toast.error(stakingTxErrorMessage(err));
      }
    },
    [address, contractReady, demoNoWallet, isConnected, writeContractAsync],
  );

  const unstake = useCallback(
    async (amount: number) => {
      if (!amount || amount <= 0) return;
      if (!isConnected && !demoNoWallet) return;
      if (demoNoWallet || !contractReady) {
        setMockStaked((s) => Math.max(0, s - amount));
        setMockWallet((w) => w + amount);
        setMockTotalStaked((t) => Math.max(0, t - amount));
        return;
      }
      if (!STAKING_ADDRESS || !address) return;
      setTxKind("unstake");
      completedOpRef.current = "unstake";
      try {
        const h = await writeContractAsync({
          address: STAKING_ADDRESS!,
          abi: STAKING_ABI,
          functionName: "unstake",
          args: [parseEther(String(amount))],
          account: address!,
        });
        setHash(h);
      } catch (err) {
        completedOpRef.current = null;
        setTxKind(null);
        toast.error(stakingTxErrorMessage(err));
      }
    },
    [address, contractReady, demoNoWallet, isConnected, writeContractAsync],
  );

  const claimRewards = useCallback(async () => {
    if (claimCooldown > 0) return;
    if (!isConnected && !demoNoWallet) return;
    const claimable = demoNoWallet || !contractReady ? mockUnclaimed : unclaimedRewards;
    if (!claimable || claimable <= 0) return;

    if (demoNoWallet || !contractReady) {
      setLifetimeEarned((e) => {
        const next = e + claimable;
        saveLifetime(next);
        return next;
      });
      setMockUnclaimed(0);
      setClaimCooldown(60);
      return;
    }
    if (!STAKING_ADDRESS || !address) return;
    claimAmountRef.current = claimable;
    setTxKind("claim");
    completedOpRef.current = "claim";
    setClaimCooldown(60);
    try {
      const h = await writeContractAsync({
        address: STAKING_ADDRESS!,
        abi: STAKING_ABI,
        functionName: "claimRewards",
        account: address!,
      });
      setHash(h);
    } catch (err) {
      claimAmountRef.current = 0;
      completedOpRef.current = null;
      setTxKind(null);
      setClaimCooldown(0);
      toast.error(stakingTxErrorMessage(err));
    }
  }, [
    address,
    claimCooldown,
    contractReady,
    demoNoWallet,
    isConnected,
    mockUnclaimed,
    unclaimedRewards,
    writeContractAsync,
  ]);

  const value: StakingContextValue = {
    stakedBalance,
    unclaimedRewards,
    totalRewardsEarned: demoNoWallet || isConnected ? lifetimeEarned : 0,
    totalStaked,
    apy,
    walletBalance,
    maxStake: MAX_STAKE_CAP,
    stake,
    unstake,
    claimRewards,
    isStaking,
    isUnstaking,
    isClaiming,
    claimCooldown,
    isWalletConnected: isConnected,
    isContractConfigured: contractReady,
    isMockMode,
  };

  return <StakingContext.Provider value={value}>{children}</StakingContext.Provider>;
}

export function useStaking(): StakingContextValue {
  const ctx = useContext(StakingContext);
  if (!ctx) throw new Error("useStaking must be used within StakingProvider");
  return ctx;
}
