import { useEffect } from "react";
import type { ScenarioKey } from "@/components/scenario/ScenarioSwitcher";
import { useRuntimeStore } from "@/lib/state/runtimeStore";

/** Bootstraps the runtime engine, optional mesh link, and heartbeat loop for a scenario workspace. */
export function useRealtimeMission(scenario: ScenarioKey) {
  const initWorkspace = useRuntimeStore((s) => s.initWorkspace);
  const shutdownRealtime = useRuntimeStore((s) => s.shutdownRealtime);

  useEffect(() => {
    void initWorkspace(scenario);
    return () => {
      shutdownRealtime();
    };
  }, [scenario, initWorkspace, shutdownRealtime]);
}
