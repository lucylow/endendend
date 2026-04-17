import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: { display_name: string | null; call_sign: string | null; team: string | null; avatar_url: string | null; region: string | null } | null;
  roles: string[];
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null, user: null, profile: null, roles: [], loading: true, signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AuthContextType["profile"]>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setTimeout(() => {
          void fetchProfile(s.user.id);
          void fetchRoles(s.user.id);
        }, 0);
      } else {
        setProfile(null);
        setRoles([]);
      }
    });

    supabase.auth
      .getSession()
      .then(({ data: { session: s }, error }) => {
        if (error) {
          if (import.meta.env.DEV) console.warn("[auth] getSession", error.message);
          setSession(null);
          setUser(null);
          setProfile(null);
          setRoles([]);
          return;
        }
        setSession(s);
        setUser(s?.user ?? null);
        if (s?.user) {
          void fetchProfile(s.user.id);
          void fetchRoles(s.user.id);
        }
      })
      .catch((err) => {
        if (import.meta.env.DEV) console.error("[auth] getSession failed", err);
        setSession(null);
        setUser(null);
        setProfile(null);
        setRoles([]);
      })
      .finally(() => {
        setLoading(false);
      });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId: string) {
    const { data, error } = await supabase
      .from("profiles")
      .select("display_name, call_sign, team, avatar_url, region")
      .eq("user_id", userId)
      .single();
    if (error) {
      if (error.code !== "PGRST116" && import.meta.env.DEV) {
        console.warn("[auth] profile load failed", error.message);
      }
      setProfile(null);
      return;
    }
    setProfile(data);
  }

  async function fetchRoles(userId: string) {
    const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    if (error) {
      if (import.meta.env.DEV) console.warn("[auth] roles load failed", error.message);
      setRoles([]);
      return;
    }
    setRoles((data ?? []).map((r) => r.role));
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error && import.meta.env.DEV) console.warn("[auth] signOut", error.message);
    setSession(null);
    setUser(null);
    setProfile(null);
    setRoles([]);
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, roles, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
