import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

export function useSwarmAssets(missionId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["swarm-assets", missionId],
    queryFn: async () => {
      let q = supabase.from("swarm_assets").select("*").order("created_at", { ascending: false });
      if (missionId) q = q.eq("mission_id", missionId);
      const { data, error } = await q.limit(100);
      if (error) throw error;
      return data;
    },
    enabled: !!missionId,
  });

  useEffect(() => {
    if (!missionId) return;
    const channel = supabase.channel(`assets-${missionId}`);
    channel.on("postgres_changes", { event: "*", schema: "public", table: "swarm_assets", filter: `mission_id=eq.${missionId}` }, () => {
      queryClient.invalidateQueries({ queryKey: ["swarm-assets", missionId] });
    });
    channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [missionId, queryClient]);

  return { assets: query.data ?? [], isLoading: query.isLoading };
}
