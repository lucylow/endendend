import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useId } from "react";
import { toast } from "sonner";

export function useMissions() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  /** Each hook instance needs its own Realtime channel name — reusing the same name returns one channel and a second `.on()` after `subscribe()` throws. */
  const realtimeChannelId = useId().replace(/:/g, "");

  const query = useQuery({
    queryKey: ["missions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("missions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`missions-realtime-${realtimeChannelId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "missions" }, () => {
        queryClient.invalidateQueries({ queryKey: ["missions"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, queryClient, realtimeChannelId]);

  const createMission = useMutation({
    mutationFn: async (input: { title: string; description?: string; mission_type?: string; priority?: string; location?: string }) => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase.from("missions").insert({
        ...input,
        created_by: user.id,
        status: "draft",
      }).select().single();
      if (error) throw error;
      // Also add creator as member
      await supabase.from("mission_members").insert({ mission_id: data.id, user_id: user.id, role: "team_lead" });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["missions"] });
      toast.success("Mission created");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMission = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; status?: string; title?: string; description?: string }) => {
      const { error } = await supabase.from("missions").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["missions"] });
      toast.success("Mission updated");
    },
    onError: (err) => toast.error(err.message),
  });

  return { missions: query.data ?? [], isLoading: query.isLoading, createMission, updateMission };
}
