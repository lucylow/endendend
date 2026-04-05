import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify the user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { title, description, mission_type, location, priority } = body;

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Title is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create mission
    const { data: mission, error: missionError } = await supabase
      .from("missions")
      .insert({
        title: title.trim(),
        description: description || null,
        mission_type: mission_type || null,
        location: location || null,
        priority: priority || "normal",
        created_by: user.id,
      })
      .select()
      .single();

    if (missionError) {
      return new Response(JSON.stringify({ error: missionError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auto-add creator as mission member
    await supabase.from("mission_members").insert({
      mission_id: mission.id,
      user_id: user.id,
      role: "lead",
    });

    // Log the event
    await supabase.from("event_logs").insert({
      actor_id: user.id,
      mission_id: mission.id,
      action: "mission_created",
      entity_type: "mission",
      entity_id: mission.id,
      metadata: { title: mission.title },
    });

    return new Response(JSON.stringify({ mission }), {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
