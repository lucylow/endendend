import type { LucideIcon } from "lucide-react";

export type MatrixTier = "free" | "pro" | "enterprise";

export interface MatrixFeature {
  title: string;
  description: string;
  free: boolean;
  pro: boolean;
  enterprise: boolean;
  icon: LucideIcon;
  gradient: string;
  /** Optional id for 3D demo highlight */
  demo?: string;
}
