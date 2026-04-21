import type { EngineSnapshot } from "./types";

export interface RecordedFrame {
  t: number;
  snapshot: EngineSnapshot;
}

/** Deterministic replay buffer (append-only during mission). */
export class MissionReplay {
  private _frames: RecordedFrame[] = [];

  record(snap: EngineSnapshot): void {
    this._frames.push({ t: snap.t, snapshot: structuredClone(snap) });
  }

  get frames(): readonly RecordedFrame[] {
    return this._frames;
  }

  clear(): void {
    this._frames.length = 0;
  }

  atIndex(i: number): RecordedFrame | undefined {
    return this._frames[i];
  }

  /** Find frame index at or before time `t` for scrubbing. */
  indexAtOrBefore(t: number): number {
    let lo = 0;
    let hi = this._frames.length - 1;
    let ans = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const ft = this._frames[mid].t;
      if (ft <= t) {
        ans = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    return ans;
  }
}
