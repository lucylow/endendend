import { createRootRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";
import { AuthProvider } from "@/contexts/AuthContext";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { WalletModal } from "@/components/WalletModal";
import { MissionShell } from "@/components/navigation/MissionShell";
import { MarketingTopNav } from "@/components/navigation/MarketingTopNav";
import { pathUsesMarketingShell, pathUsesMissionChrome } from "@/lib/missionChrome";
import NotFound from "@/pages/NotFound";

function RootLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const marketing = pathUsesMarketingShell(pathname);
  const mission = pathUsesMissionChrome(pathname);

  return (
    <>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <WalletModal />
        {marketing ? (
          <div className="min-h-screen bg-zinc-950 bg-[var(--gradient-hero)] text-zinc-100">
            <MarketingTopNav />
            <Outlet />
          </div>
        ) : mission ? (
          <MissionShell />
        ) : (
          <div className="min-h-screen bg-background text-foreground">
            <Outlet />
          </div>
        )}
      </AuthProvider>
      <TanStackRouterDevtools position="bottom-right" initialIsOpen={false} />
    </>
  );
}

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFound,
});
