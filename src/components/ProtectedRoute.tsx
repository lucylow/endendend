import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const location = useLocation();

  // Allow demo access to dashboard routes without auth
  if (loading) return <div className="min-h-screen bg-background" />;
  if (!session && !location.pathname.startsWith("/dashboard")) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}
