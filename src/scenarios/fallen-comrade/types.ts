import type { RoverState } from "@/stores/swarmStore";

export type Bounds = readonly [number, number, number, number];

export type FallenTrack2Frame = {
  time: number;
  global_map: number[][];
  reallocated: boolean;
  rovers: RoverState[];
  victims?: Array<Record<string, unknown>>;
  obstacles?: unknown[];
  events?: unknown[];
  scenario_meta?: Record<string, unknown>;
};

export const ROVER_IDS = ["RoverA", "RoverB", "RoverC", "RoverD", "RoverE"] as const;
