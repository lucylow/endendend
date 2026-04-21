export type VictimJson = { id: string; pos: [number, number, number]; type?: string };

export type HandoffWorldJson = {
  bounds: [number, number, number, number];
  victims: VictimJson[];
};
