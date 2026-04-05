import * as THREE from "three";

export type StockShelf = { index: number; x: number; z: number; inventory: number };

export class DynamicInventoryEngine {
  getNearestStockedShelfIndex(shelves: StockShelf[], agentPos: THREE.Vector3): number {
    let best = -1;
    let bestScore = -Infinity;
    for (const s of shelves) {
      if (s.inventory <= 0) continue;
      const dx = s.x - agentPos.x;
      const dz = s.z - agentPos.z;
      const d = Math.hypot(dx, dz);
      const score = s.inventory / (d + 1);
      if (score > bestScore) {
        bestScore = score;
        best = s.index;
      }
    }
    return best;
  }

  getNearestStockedShelfWorld(shelves: StockShelf[], agentPos: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
    const idx = this.getNearestStockedShelfIndex(shelves, agentPos);
    if (idx < 0) {
      out.set(0, 0, 0);
      return out;
    }
    const s = shelves.find((sh) => sh.index === idx);
    if (!s) {
      out.set(0, 0, 0);
      return out;
    }
    out.set(s.x, 0, s.z);
    return out;
  }
}
