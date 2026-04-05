import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, LifeBuoy, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import ScenarioWalkthroughPanel from "@/components/scenarios/ScenarioWalkthroughPanel";
import { getScenarioWalkthrough } from "@/lib/scenarios/scenarioWalkthroughs";
import { cn } from "@/lib/utils";

interface Props {
  slug: string;
  sarLink?: string;
  bgClass?: string;
  children: React.ReactNode;
}

/**
 * Shared shell for standalone scenario demo pages.
 * Adds a header + optional walkthrough guide panel on the right.
 */
export default function ScenarioDemoShell({ slug, sarLink = "/scenarios/search-rescue", bgClass = "bg-black", children }: Props) {
  const walkthrough = getScenarioWalkthrough(slug);
  const [guideOpen, setGuideOpen] = useState(false);

  return (
    <div className={cn("min-h-screen text-foreground", bgClass)}>
      <header className="sticky top-0 z-50 border-b border-zinc-800/70 bg-zinc-950/90 backdrop-blur-md">
        <div className="mx-auto flex h-12 max-w-[1600px] items-center justify-between gap-3 px-4 sm:px-6">
          <Button variant="ghost" size="sm" asChild className="gap-2 text-zinc-400 hover:text-foreground">
            <Link to="/">
              <ArrowLeft className="h-4 w-4" />
              Home
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            {walkthrough && (
              <Button
                variant={guideOpen ? "default" : "outline"}
                size="sm"
                onClick={() => setGuideOpen(!guideOpen)}
                className={cn(
                  "text-xs gap-1.5",
                  guideOpen
                    ? "bg-primary/20 text-primary border-primary/30 hover:bg-primary/30"
                    : "border-zinc-700"
                )}
              >
                <BookOpen className="h-3.5 w-3.5" />
                Guide
              </Button>
            )}
            <Button variant="outline" size="sm" asChild className="border-zinc-700 text-xs">
              <Link to={sarLink}>
                <LifeBuoy className="mr-1.5 h-3.5 w-3.5" />
                SAR index
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="relative">
        {children}

        {/* Walkthrough guide panel — slides in from right */}
        {walkthrough && guideOpen && (
          <div className="fixed top-12 right-0 bottom-0 z-40 w-full max-w-sm overflow-y-auto border-l border-zinc-800/70 bg-zinc-950/95 backdrop-blur-xl p-4 shadow-2xl shadow-black/50">
            <ScenarioWalkthroughPanel walkthrough={walkthrough} />
          </div>
        )}
      </div>
    </div>
  );
}
