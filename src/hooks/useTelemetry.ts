import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

export function useTelemetry(missionId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["telemetry", missionId],
    queryFn: async () => {
      let q = supabase.from("telemetry_events").select("*").order("recorded_at", { ascending: false });
      if (missionId) q = q.eq("mission_id", missionId);
      const { data, error } = await q.limit(200);
      if (error) throw error;
      return data;
    },
    enabled: !!missionId,
  });

  useEffect(() => {
    if (!missionId) return;
    const channel = supabase
      .channel(`telemetry-${missionId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "telemetry_events", filter: `mission_id=eq.${missionId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["telemetry", missionId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [missionId, queryClient]);

  return { telemetry: query.data ?? [], isLoading: query.isLoading };
}
