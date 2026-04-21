import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { DEFAULT_DEMO_PERSONA_ID } from "@/wallet/demoPersonas";
import { clearPersistedSession, readPersistedSession } from "@/wallet/sessionStorage";
import { walletService, mockWalletAdapter } from "@/wallet/walletService";
import { resetWalletStoreForTests, useWalletStore } from "@/wallet/walletStore";

describe("wallet subsystem", () => {
  beforeEach(async () => {
    clearPersistedSession();
    resetWalletStoreForTests();
    await walletService._resetAdapters();
  });

  afterEach(async () => {
    clearPersistedSession();
    resetWalletStoreForTests();
    await walletService._resetAdapters();
  });

  it("connects mock wallet and persists session", async () => {
    const ok = await walletService.connectDemo({ personaId: DEFAULT_DEMO_PERSONA_ID });
    expect(ok).toBe(true);
    expect(useWalletStore.getState().mode).toBe("mock");
    expect(useWalletStore.getState().account?.isMock).toBe(true);
    const blob = readPersistedSession();
    expect(blob?.demoMode).toBe(true);
    expect(blob?.accountAddress).toMatch(/^0x[0-9a-f]{40}$/i);
  });

  it("restores mock session on service reconnect path", async () => {
    await walletService.connectDemo({ personaId: "explorer-drone" });
    const addr = useWalletStore.getState().account?.address;
    expect(readPersistedSession()).not.toBeNull();
    resetWalletStoreForTests();
    await mockWalletAdapter.disconnect();
    expect(useWalletStore.getState().mode).toBe("disconnected");
    expect(readPersistedSession()).not.toBeNull();
    await walletService.restorePersistedSession();
    expect(useWalletStore.getState().mode).toBe("mock");
    expect(useWalletStore.getState().account?.address).toBe(addr);
  });

  it("switches demo persona and updates address", async () => {
    await walletService.connectDemo({ personaId: DEFAULT_DEMO_PERSONA_ID });
    const a1 = useWalletStore.getState().account?.address;
    await walletService.switchDemoPersona("arc-settler");
    const a2 = useWalletStore.getState().account?.address;
    expect(a1).toBeTruthy();
    expect(a2).toBeTruthy();
    expect(a1).not.toBe(a2);
    expect(useWalletStore.getState().demoPersonaId).toBe("arc-settler");
  });

  it("records simulated signatures", async () => {
    await walletService.connectDemo();
    await walletService.signMessage("mission check-in", "mission_check_in");
    expect(useWalletStore.getState().signatureHistory.length).toBe(1);
    expect(useWalletStore.getState().signatureHistory[0].simulated).toBe(true);
    expect(useWalletStore.getState().signatureHistory[0].signature.startsWith("0xmock")).toBe(true);
  });
});
