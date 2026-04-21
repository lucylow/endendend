import { Outlet } from "@tanstack/react-router";
import { DesktopSidebar } from "@/components/navigation/DesktopSidebar";
import { MobileBottomNav } from "@/components/navigation/MobileBottomNav";
import { EstopFab } from "@/components/navigation/EstopFab";

export function MissionShell() {
  return (
    <div className="flex min-h-screen bg-zinc-950 bg-[var(--gradient-hero)] text-zinc-100">
      <DesktopSidebar />
      <div className="relative flex min-h-0 flex-1 flex-col pb-20 md:pb-0">
        <main className="flex-1 overflow-auto p-3 md:p-6">
          <Outlet />
        </main>
        <MobileBottomNav />
        <EstopFab />
      </div>
    </div>
  );
}
