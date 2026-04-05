export interface PathProposal {
  id: string;
  waypoints: { x: number; y: number; z: number }[];
  score: number;
}
