import { create } from "zustand";

/**
 * Cross-panel 3D map overlay controls (scenario sliders ↔ BlackoutWorldMap3D).
 */
type MapOverlayState = {
  thermalOpacity01: number;
  waterOpacity01: number;
  waterLevelBoost01: number;
  gasContourIntensity01: number;
  showGeofence: boolean;
  showExploredGrid: boolean;
  selectedTargetId: string | null;
  setThermalOpacity01: (v: number) => void;
  setWaterOpacity01: (v: number) => void;
  setWaterLevelBoost01: (v: number) => void;
  setGasContourIntensity01: (v: number) => void;
  setShowGeofence: (v: boolean) => void;
  setShowExploredGrid: (v: boolean) => void;
  setSelectedTargetId: (id: string | null) => void;
};

export const useMapOverlayStore = create<MapOverlayState>((set) => ({
  thermalOpacity01: 0.55,
  waterOpacity01: 0.35,
  waterLevelBoost01: 0,
  gasContourIntensity01: 0.65,
  showGeofence: true,
  showExploredGrid: true,
  selectedTargetId: null,
  setThermalOpacity01: (v) => set({ thermalOpacity01: Math.max(0, Math.min(1, v)) }),
  setWaterOpacity01: (v) => set({ waterOpacity01: Math.max(0, Math.min(1, v)) }),
  setWaterLevelBoost01: (v) => set({ waterLevelBoost01: Math.max(0, Math.min(1, v)) }),
  setGasContourIntensity01: (v) => set({ gasContourIntensity01: Math.max(0, Math.min(1, v)) }),
  setShowGeofence: (v) => set({ showGeofence: v }),
  setShowExploredGrid: (v) => set({ showExploredGrid: v }),
  setSelectedTargetId: (id) => set({ selectedTargetId: id }),
}));
