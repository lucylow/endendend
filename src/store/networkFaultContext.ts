/** Shared packet-loss % for P2P tick (avoids p2pStore ↔ swarmStore import cycle). */
let packetLossPercent = 0;

export function setNetworkFaultPacketLoss(percent: number): void {
  packetLossPercent = Math.max(0, Math.min(100, percent));
}

export function getNetworkFaultPacketLoss(): number {
  return packetLossPercent;
}
