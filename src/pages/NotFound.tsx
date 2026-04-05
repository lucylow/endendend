import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Hexagon } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404: missing route", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
      <div className="text-center max-w-md space-y-6">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-card/50">
          <Hexagon className="h-7 w-7 text-primary" strokeWidth={2} />
        </div>
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">404</p>
          <h1 className="mt-2 text-3xl font-bold text-foreground tracking-tight">This route is not in the mesh</h1>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            The path <span className="font-mono text-foreground/90">{location.pathname}</span> does not map to a control
            center page. Jump back to the landing experience or open the dashboard.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild className="glow-cyan">
            <Link to="/">Back to home</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/dashboard">Dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
