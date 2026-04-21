import { motion, AnimatePresence } from "framer-motion";
import { useSwarmStore } from "@/stores/swarmStore";

export function ReallocAnim() {
  const reallocated = useSwarmStore((s) => s.reallocated);

  return (
    <AnimatePresence>
      {reallocated ? (
        <motion.div
          key="realloc"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          className="pointer-events-none absolute bottom-8 left-1/2 z-10 w-[min(90vw,28rem)] -translate-x-1/2 rounded-lg border border-emerald-500/50 bg-emerald-950/80 px-4 py-2 text-center font-mono text-xs text-emerald-100 shadow-lg backdrop-blur"
        >
          Reallocation: dead sector split across survivors — exploration deduped via shared map
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
