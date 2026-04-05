import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Siren } from "lucide-react";
import type { HealthAlert } from "@/features/health/types";
import { useCriticalVoiceAlerts } from "@/features/health/useRobotHealth";

export interface CriticalAlertHUDProps {
  alerts: HealthAlert[];
}

export function CriticalAlertHUD({ alerts }: CriticalAlertHUDProps) {
  const criticalAlerts = alerts.filter((a) => a.severity === "critical");
  useCriticalVoiceAlerts(alerts);

  return (
    <AnimatePresence>
      {criticalAlerts.length > 0 && (
        <motion.div
          key="critical-hud"
          className="pointer-events-none absolute left-1/2 top-[5.5rem] z-[60] w-[min(100%,22rem)] -translate-x-1/2 px-3 sm:top-24"
          initial={{ opacity: 0, scale: 0.92, y: -16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: -16 }}
          transition={{ type: "spring", stiffness: 380, damping: 28 }}
        >
          <div className="rounded-2xl border border-red-500/40 bg-red-950/95 p-4 shadow-2xl shadow-red-950/50 backdrop-blur-xl sm:p-5">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-red-400/40 bg-red-500/15">
                <Siren className="h-5 w-5 text-red-400" aria-hidden />
              </div>
              <div>
                <h3 className="text-base font-bold tracking-tight text-red-50">Critical alerts</h3>
                <div className="mt-1 flex gap-1">
                  {Array.from({ length: Math.min(criticalAlerts.length, 4) }).map((_, i) => (
                    <span
                      key={i}
                      className="h-1.5 w-1.5 rounded-full bg-red-400"
                      style={{ animation: "pulse 1.2s ease-in-out infinite", animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <ul className="space-y-2">
              {criticalAlerts.slice(0, 4).map((alert) => (
                <li
                  key={alert.id}
                  className="flex gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2.5 text-sm text-red-50/95"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden />
                  <div className="min-w-0 leading-snug">
                    <div className="font-mono text-[11px] text-red-300/90">{alert.agentId}</div>
                    <div className="text-[13px]">{alert.message}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
