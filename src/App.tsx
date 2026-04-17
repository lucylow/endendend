import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { wagmiConfig } from "@/lib/wagmi";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Landing from "@/pages/Landing";
import Index from "@/pages/Index";
import Docs from "@/pages/Docs";
import Admin from "@/pages/Admin";
import AuthPage from "@/pages/Auth";
import NotFound from "@/pages/NotFound";
import DashboardLayout from "@/layouts/DashboardLayout";
import DashboardOverview from "@/pages/dashboard/Overview";
import SimulationPage from "@/pages/dashboard/Simulation";
import AnalyticsPage from "@/pages/dashboard/Analytics";
import AuctionsPage from "@/pages/dashboard/Auctions";
import StakingPage from "@/pages/dashboard/Staking";
import BillingPage from "@/pages/dashboard/Billing";
import ReplayPage from "@/pages/dashboard/Replay";
import AgentsPage from "@/pages/dashboard/Agents";
import AgentDetailPage from "@/pages/dashboard/AgentDetail";
import SettingsPage from "@/pages/dashboard/Settings";
import ScenariosPage from "@/pages/dashboard/Scenarios";
import SwarmVisualizationPage from "@/pages/dashboard/SwarmVisualization";
import VictimDetectionPage from "@/pages/dashboard/VictimDetection";
import ScalabilityPage from "@/pages/dashboard/Scalability";
import SearchRescueDemo from "@/pages/scenarios/SearchRescueDemo";
import ArenaObstacleDemo from "@/pages/scenarios/ArenaObstacleDemo";
import MultiSwarmHandoffDemo from "@/pages/scenarios/MultiSwarmHandoffDemo";
import ThermalRebalanceDemo from "@/pages/scenarios/ThermalRebalanceDemo";
import MagneticAttractionDemo from "@/pages/scenarios/MagneticAttractionDemo";
import CollapsingTunnelDemo from "@/pages/scenarios/CollapsingTunnelDemo";
import BatteryCascadeDemo from "@/pages/scenarios/BatteryCascadeDemo";
import ObstacleBypassDemo from "@/pages/scenarios/ObstacleBypassDemo";
import StakeVotingDemo from "@/pages/scenarios/StakeVotingDemo";
import PredatorEvasionDemo from "@/pages/scenarios/PredatorEvasionDemo";
import RandomFailureDemo from "@/pages/scenarios/RandomFailureDemo";
import WarehouseRestockingDemo from "@/pages/scenarios/WarehouseRestockingDemo";
import { SAR_SCENARIOS } from "@/lib/scenarios/registry";

const defaultSarSlug = SAR_SCENARIOS[0]?.slug ?? "dynamic-relay";
const SCENARIO_FULL_PAGE_SLUGS = new Set([
  "battery-cascade",
  "circular-bypass",
  "stake-voting",
  "predator-evasion",
  "random-failure",
  "warehouse-restock",
]);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <WagmiProvider config={wagmiConfig}>
    <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/vertex-swarm" element={<Index />} />
              <Route
                path="/scenarios/search-rescue"
                element={<Navigate to={`/scenarios/search-rescue/${defaultSarSlug}`} replace />}
              />
              <Route path="/scenarios/arena-obstacle" element={<ArenaObstacleDemo />} />
              <Route path="/scenarios/multi-swarm-handoff" element={<MultiSwarmHandoffDemo />} />
              <Route path="/scenarios/thermal-rebalance" element={<ThermalRebalanceDemo />} />
              <Route path="/scenarios/magnetic-attraction" element={<MagneticAttractionDemo />} />
              <Route path="/scenarios/collapsing-tunnel" element={<CollapsingTunnelDemo />} />
              <Route path="/scenarios/search-rescue/:scenarioSlug" element={<SearchRescueDemo />} />
              <Route path="/scenarios/battery-cascade" element={<BatteryCascadeDemo />} />
              <Route path="/scenarios/stake-voting" element={<StakeVotingDemo />} />
              <Route path="/scenarios/predator-evasion" element={<PredatorEvasionDemo />} />
              <Route path="/scenarios/obstacle-bypass" element={<ObstacleBypassDemo />} />
              <Route path="/scenarios/circular-bypass" element={<ObstacleBypassDemo />} />
              <Route path="/scenarios/random-failure" element={<RandomFailureDemo />} />
              <Route path="/scenarios/warehouse-restock" element={<WarehouseRestockingDemo />} />
              <Route path="/scenarios/warehouse-restocking" element={<WarehouseRestockingDemo />} />
              {SAR_SCENARIOS.filter((s) => !SCENARIO_FULL_PAGE_SLUGS.has(s.slug)).map((s) => (
                <Route
                  key={s.slug}
                  path={`/scenarios/${s.slug}`}
                  element={<Navigate to={`/scenarios/search-rescue/${s.slug}`} replace />}
                />
              ))}
              <Route path="/docs" element={<Docs />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/dashboard" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>} errorElement={<div className="min-h-screen bg-background flex items-center justify-center text-foreground"><div className="text-center space-y-2"><h1 className="text-xl font-bold">Dashboard Error</h1><p className="text-muted-foreground">Something went wrong. <a href="/dashboard" className="text-primary underline">Reload</a></p></div></div>}>
                <Route index element={<ErrorBoundary fallback={<div className="p-8 text-muted-foreground">Failed to load overview. <a href="/dashboard" className="text-primary underline">Retry</a></div>}><DashboardOverview /></ErrorBoundary>} />
                <Route path="simulation" element={<SimulationPage />} />
                <Route path="swarm" element={<SwarmVisualizationPage />} />
                <Route path="victim-detection" element={<VictimDetectionPage />} />
                <Route path="scalability" element={<ScalabilityPage />} />
                <Route path="analytics" element={<AnalyticsPage />} />
                <Route path="auctions" element={<AuctionsPage />} />
                <Route
                  path="staking"
                  element={
                    <ErrorBoundary
                      fallback={
                        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground">
                          <p className="max-w-md text-sm">The staking dashboard hit a runtime error (common in embedded previews).</p>
                          <a href="/dashboard/staking" className="text-sm text-primary underline">
                            Reload staking
                          </a>
                        </div>
                      }
                    >
                      <StakingPage />
                    </ErrorBoundary>
                  }
                />
                <Route path="billing" element={<BillingPage />} />
                <Route path="replay" element={<ReplayPage />} />
                <Route path="agents" element={<AgentsPage />} />
                <Route path="agents/:id" element={<AgentDetailPage />} />
                <Route path="scenarios" element={<ScenariosPage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
    </QueryClientProvider>
    </WagmiProvider>
  );
}

export default App;
