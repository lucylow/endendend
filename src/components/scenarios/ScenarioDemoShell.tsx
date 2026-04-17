import { useId, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, BookOpen, LayoutDashboard, LifeBuoy, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import ScenarioWalkthroughPanel from "@/components/scenarios/ScenarioWalkthroughPanel";
import { getScenarioWalkthrough } from "@/lib/scenarios/scenarioWalkthroughs";
import { getScenarioBySlug } from "@/lib/scenarios/registry";
import { cn } from "@/lib/utils";

function titleCaseSlug(slug: string) {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export interface ScenarioDemoShellProps {
  /** Key for walkthrough content (may differ from registry slug, e.g. `collapsing-tunnel`). */
  slug: string;
  /** Optional registry slug for title / tagline (e.g. `tunnel-collapse` when slug is `collapsing-tunnel`). */
  registrySlug?: string;
  sarLink?: string;
  bgClass?: string;
  children: React.ReactNode;
}

/**
 * Shared shell for standalone scenario demo pages: consistent nav, skip link, optional walkthrough sheet.
 */
export default function ScenarioDemoShell({
  slug,
  registrySlug,
  sarLink = "/scenarios/search-rescue",
  /** Most scenario canvases are authored for a dark stage; keep black default unless a page sets `bg-background`. */
  bgClass = "bg-black",
  children,
}: ScenarioDemoShellProps) {
  const mainId = useId();
  const mainDomId = `scenario-main-${mainId.replace(/:/g, "")}`;

  const walkthrough = getScenarioWalkthrough(slug);
  const [guideOpen, setGuideOpen] = useState(false);

  const scenarioMeta = useMemo(() => getScenarioBySlug(registrySlug ?? slug), [registrySlug, slug]);
  const displayName = scenarioMeta?.name ?? titleCaseSlug(slug);
  const tagline = scenarioMeta?.tagline;
  const emoji = scenarioMeta?.emoji;

  return (
    <div className={cn("min-h-screen text-foreground", bgClass)}>
      <a
        href={`#${mainDomId}`}
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:shadow-lg"
      >
        Skip to simulation
      </a>

      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/85 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <Button variant="ghost" size="sm" asChild className="shrink-0 gap-1.5 text-muted-foreground hover:text-foreground">
              <Link to="/">
                <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
                Home
              </Link>
            </Button>
            <span className="hidden h-4 w-px shrink-0 bg-border sm:block" aria-hidden />

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 truncate">
                {emoji ? (
                  <span className="text-lg leading-none" aria-hidden>
                    {emoji}
                  </span>
                ) : null}
                <h1 className="truncate text-sm font-semibold tracking-tight sm:text-base">{displayName}</h1>
                {scenarioMeta?.phase != null ? (
                  <Badge variant="outline" className="hidden shrink-0 font-mono text-[10px] md:inline-flex">
                    Phase {scenarioMeta.phase}
                  </Badge>
                ) : null}
              </div>
              {tagline ? (
                <p className="hidden truncate text-xs text-muted-foreground sm:block">{tagline}</p>
              ) : null}
            </div>
          </div>

          <nav
            className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 sm:gap-2"
            aria-label="Scenario navigation"
          >
            {walkthrough ? (
              <Button
                variant={guideOpen ? "default" : "outline"}
                size="sm"
                onClick={() => setGuideOpen(true)}
                className="h-8 gap-1 text-xs"
                aria-expanded={guideOpen}
                aria-controls="scenario-walkthrough-sheet"
              >
                <BookOpen className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="hidden sm:inline">Guide</span>
              </Button>
            ) : null}
            <Button variant="outline" size="sm" asChild className="h-8 text-xs">
              <Link to={sarLink}>
                <LifeBuoy className="mr-1 h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="hidden sm:inline">SAR hub</span>
                <span className="sm:hidden">SAR</span>
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild className="hidden h-8 text-xs md:inline-flex">
              <Link to="/dashboard/scenarios">
                <LayoutDashboard className="mr-1 h-3.5 w-3.5 shrink-0" aria-hidden />
                Index
              </Link>
            </Button>
            <Button variant="secondary" size="sm" asChild className="hidden h-8 text-xs lg:inline-flex">
              <Link to="/dashboard/swarm">
                <Radio className="mr-1 h-3.5 w-3.5 shrink-0" aria-hidden />
                Classic viz
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      <main id={mainDomId} tabIndex={-1} className="outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background">
        {children}
      </main>

      {walkthrough ? (
        <Sheet open={guideOpen} onOpenChange={setGuideOpen}>
          <SheetContent
            id="scenario-walkthrough-sheet"
            side="right"
            className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md"
          >
            <SheetTitle className="sr-only">Scenario walkthrough for {displayName}</SheetTitle>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-6 pt-12">
              <ScenarioWalkthroughPanel walkthrough={walkthrough} />
            </div>
          </SheetContent>
        </Sheet>
      ) : null}
    </div>
  );
}
