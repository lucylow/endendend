/**
 * Last-writer-wins merge for discovery / map deltas with proof of recency (tick + source).
 */
export type VersionedCell<T> = { tick: number; source: string; value: T };

export function mergeLww<T>(current: VersionedCell<T> | undefined, incoming: VersionedCell<T>): VersionedCell<T> {
  if (!current) return incoming;
  if (incoming.tick > current.tick) return incoming;
  if (incoming.tick === current.tick && incoming.source > current.source) return incoming;
  return current;
}
