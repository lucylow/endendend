
-- Role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'operator', 'team_lead');

-- User roles table (separate from profiles per security best practice)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles without recursion
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  display_name TEXT,
  call_sign TEXT,
  team TEXT,
  avatar_url TEXT,
  region TEXT,
  last_active TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles viewable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  -- Default role: operator
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'operator');
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER update_profiles_ts BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Missions
CREATE TABLE public.missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused','completed','archived','failed')),
  mission_type TEXT,
  location TEXT,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low','normal','high','critical')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_missions_ts BEFORE UPDATE ON public.missions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Mission members
CREATE TABLE public.mission_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID REFERENCES public.missions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT DEFAULT 'operator',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (mission_id, user_id)
);
ALTER TABLE public.mission_members ENABLE ROW LEVEL SECURITY;

-- Helper: is user a member of mission?
CREATE OR REPLACE FUNCTION public.is_mission_member(_user_id UUID, _mission_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.mission_members WHERE user_id = _user_id AND mission_id = _mission_id
  ) OR EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin'
  )
$$;

-- Mission RLS
CREATE POLICY "Members can view missions" ON public.missions FOR SELECT TO authenticated
  USING (public.is_mission_member(auth.uid(), id) OR created_by = auth.uid());
CREATE POLICY "Team leads/admins create missions" ON public.missions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Creator/admin update missions" ON public.missions FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Mission members RLS
CREATE POLICY "Members view membership" ON public.mission_members FOR SELECT TO authenticated
  USING (public.is_mission_member(auth.uid(), mission_id));
CREATE POLICY "Creator/admin add members" ON public.mission_members FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.missions WHERE id = mission_id AND created_by = auth.uid()) OR public.has_role(auth.uid(), 'admin'));

-- Swarm assets
CREATE TABLE public.swarm_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID REFERENCES public.missions(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  asset_type TEXT NOT NULL DEFAULT 'drone' CHECK (asset_type IN ('drone','rover','relay','sensor')),
  status TEXT DEFAULT 'idle' CHECK (status IN ('idle','active','returning','offline','failed')),
  battery NUMERIC(5,2),
  signal_quality NUMERIC(5,2),
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  altitude DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.swarm_assets ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_swarm_assets_ts BEFORE UPDATE ON public.swarm_assets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE POLICY "Members view assets" ON public.swarm_assets FOR SELECT TO authenticated
  USING (public.is_mission_member(auth.uid(), mission_id));
CREATE POLICY "Members manage assets" ON public.swarm_assets FOR INSERT TO authenticated
  WITH CHECK (public.is_mission_member(auth.uid(), mission_id));
CREATE POLICY "Members update assets" ON public.swarm_assets FOR UPDATE TO authenticated
  USING (public.is_mission_member(auth.uid(), mission_id));

-- Telemetry events
CREATE TABLE public.telemetry_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID REFERENCES public.swarm_assets(id) ON DELETE CASCADE NOT NULL,
  mission_id UUID REFERENCES public.missions(id) ON DELETE CASCADE NOT NULL,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  altitude DOUBLE PRECISION,
  battery NUMERIC(5,2),
  signal_quality NUMERIC(5,2),
  status TEXT,
  notes TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.telemetry_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_telemetry_mission ON public.telemetry_events(mission_id);
CREATE INDEX idx_telemetry_asset ON public.telemetry_events(asset_id);
CREATE POLICY "Members view telemetry" ON public.telemetry_events FOR SELECT TO authenticated
  USING (public.is_mission_member(auth.uid(), mission_id));
CREATE POLICY "Members insert telemetry" ON public.telemetry_events FOR INSERT TO authenticated
  WITH CHECK (public.is_mission_member(auth.uid(), mission_id));

-- Uploaded assets
CREATE TABLE public.uploaded_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID REFERENCES public.missions(id) ON DELETE CASCADE NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id) NOT NULL,
  file_name TEXT NOT NULL,
  bucket_path TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN ('pending','processing','completed','failed')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.uploaded_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view uploads" ON public.uploaded_assets FOR SELECT TO authenticated
  USING (public.is_mission_member(auth.uid(), mission_id));
CREATE POLICY "Members create uploads" ON public.uploaded_assets FOR INSERT TO authenticated
  WITH CHECK (public.is_mission_member(auth.uid(), mission_id) AND auth.uid() = uploaded_by);

-- Event logs (audit trail)
CREATE TABLE public.event_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id),
  mission_id UUID REFERENCES public.missions(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.event_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_event_logs_mission ON public.event_logs(mission_id);
CREATE POLICY "Members view logs" ON public.event_logs FOR SELECT TO authenticated
  USING (mission_id IS NULL OR public.is_mission_member(auth.uid(), mission_id));
CREATE POLICY "System inserts logs" ON public.event_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = actor_id);

-- Scenario runs
CREATE TABLE public.scenario_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID REFERENCES public.missions(id) ON DELETE SET NULL,
  scenario_type TEXT NOT NULL,
  started_by UUID REFERENCES auth.users(id) NOT NULL,
  status TEXT DEFAULT 'running' CHECK (status IN ('running','completed','failed','cancelled')),
  outcome TEXT,
  duration_ms INTEGER,
  telemetry_snapshot JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
ALTER TABLE public.scenario_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users view scenario runs" ON public.scenario_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users create runs" ON public.scenario_runs FOR INSERT TO authenticated WITH CHECK (auth.uid() = started_by);
CREATE POLICY "Creator update runs" ON public.scenario_runs FOR UPDATE TO authenticated USING (started_by = auth.uid());

-- AI summaries
CREATE TABLE public.ai_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID REFERENCES public.missions(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES public.swarm_assets(id) ON DELETE CASCADE,
  scenario_run_id UUID REFERENCES public.scenario_runs(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  summary_type TEXT DEFAULT 'mission',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view summaries" ON public.ai_summaries FOR SELECT TO authenticated
  USING (mission_id IS NULL OR public.is_mission_member(auth.uid(), mission_id));

-- Function jobs
CREATE TABLE public.function_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed')),
  input JSONB DEFAULT '{}',
  output JSONB,
  error_message TEXT,
  retries INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  created_by UUID REFERENCES auth.users(id),
  mission_id UUID REFERENCES public.missions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
ALTER TABLE public.function_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own jobs" ON public.function_jobs FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Auth users create jobs" ON public.function_jobs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- User roles RLS
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('mission-media', 'mission-media', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('operator-uploads', 'operator-uploads', false);

-- Storage policies
CREATE POLICY "Public read mission media" ON storage.objects FOR SELECT USING (bucket_id = 'mission-media');
CREATE POLICY "Auth upload mission media" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'mission-media');
CREATE POLICY "Auth upload operator files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'operator-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users read own operator files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'operator-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
