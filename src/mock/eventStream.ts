import type { MockEventKind, MockStreamEvent } from "./types";

export type StreamControls = {
  paused: boolean;
  speed: number;
};

export class MockEventStream {
  private events: MockStreamEvent[] = [];
  private seq = 0;
  private controls: StreamControls = { paused: false, speed: 1 };

  setControls(partial: Partial<StreamControls>): void {
    this.controls = { ...this.controls, ...partial };
  }

  getControls(): StreamControls {
    return { ...this.controls };
  }

  emit(kind: MockEventKind, payload: Record<string, unknown>, at = Date.now()): MockStreamEvent | null {
    if (this.controls.paused) return null;
    this.seq += 1;
    const ev: MockStreamEvent = { id: `ev-${this.seq}`, kind, at, payload };
    this.events.push(ev);
    if (this.events.length > 2000) this.events.splice(0, this.events.length - 2000);
    return ev;
  }

  /** Events in [from, to] inclusive by `at`. */
  window(from: number, to: number): MockStreamEvent[] {
    return this.events.filter((e) => e.at >= from && e.at <= to);
  }

  tail(n: number): MockStreamEvent[] {
    return this.events.slice(-n);
  }

  /** Deterministic replay: returns same slice order as stored. */
  replaySlice(startIdx: number, len: number): MockStreamEvent[] {
    return this.events.slice(startIdx, startIdx + len);
  }

  clear(): void {
    this.events = [];
    this.seq = 0;
  }

  all(): MockStreamEvent[] {
    return [...this.events];
  }
}
