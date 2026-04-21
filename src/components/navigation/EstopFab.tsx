import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function EstopFab({ className }: { className?: string }) {
  return (
    <button
      type="button"
      aria-label="Emergency stop all drones"
      className={cn(
        "fixed bottom-20 right-4 z-[60] flex h-14 w-14 items-center justify-center rounded-full border-2 border-red-500/80 bg-red-600 text-lg font-black text-white shadow-[0_0_24px_rgba(220,38,38,0.55)] transition hover:scale-105 hover:bg-red-500 md:bottom-8",
        className,
      )}
      onClick={() => toast.error("E-STOP engaged (demo) — swarm halted")}
    >
      ⏹
    </button>
  );
}
