/** Minimal BehaviorSubject implementation (no RxJS dependency). */
export class BehaviorSubject<T> {
  private value: T;
  private listeners = new Set<(val: T) => void>();

  constructor(initial: T) {
    this.value = initial;
  }

  getValue(): T {
    return this.value;
  }

  next(val: T) {
    this.value = val;
    this.listeners.forEach((fn) => {
      try { fn(val); } catch { /* swallow */ }
    });
  }

  subscribe(fn: (val: T) => void): { unsubscribe: () => void } {
    this.listeners.add(fn);
    try { fn(this.value); } catch { /* swallow */ }
    return { unsubscribe: () => this.listeners.delete(fn) };
  }
}
