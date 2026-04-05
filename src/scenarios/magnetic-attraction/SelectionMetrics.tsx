import { motion } from "framer-motion";
import { Magnet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useMagneticAttractionStore } from "./magneticAttractionStore";

export default function SelectionMetrics() {
  const optimalSelectionRate = useMagneticAttractionStore((s) => s.optimalSelectionRate);
  const randomRate = useMagneticAttractionStore((s) => s.randomRate);
  const convergenceTargetId = useMagneticAttractionStore((s) => s.convergenceTargetId);
  const victims = useMagneticAttractionStore((s) => s.victims);
  const focus = victims.find((v) => v.id === convergenceTargetId) ?? victims[5]!;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-purple-500/35 bg-zinc-950/80 p-6 shadow-xl backdrop-blur-xl">
        <h3 className="mb-6 flex items-center gap-2 text-xl font-bold text-purple-400">
          <Magnet className="h-6 w-6" />
          Target selection intelligence
        </h3>

        <div className="mb-6 grid grid-cols-2 gap-8 text-center">
          <div>
            <div className="text-4xl font-black tabular-nums text-purple-400">{optimalSelectionRate.toFixed(0)}%</div>
            <div className="mt-1 text-sm text-zinc-400">Stake-weighted field</div>
          </div>
          <div>
            <div className="text-4xl font-black tabular-nums text-zinc-500">{randomRate.toFixed(0)}%</div>
            <div className="mt-1 text-sm text-zinc-400">Random baseline</div>
          </div>
        </div>

        <div className="text-center">
          <div className="text-2xl font-black text-transparent bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text">
            Emergent prioritization
          </div>
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-zinc-800/60 bg-zinc-950/70 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-zinc-300">Converged focal target</span>
          <Badge className="font-mono">
            {focus.id} ({focus.value.toFixed(1)} value)
          </Badge>
        </div>
        <div className="h-4 w-full overflow-hidden rounded-full bg-zinc-800">
          <motion.div
            className="h-4 rounded-full bg-purple-500"
            initial={false}
            animate={{ width: `${Math.min(100, optimalSelectionRate)}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        </div>
      </div>
    </div>
  );
}
