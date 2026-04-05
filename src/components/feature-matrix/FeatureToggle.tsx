import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

interface FeatureToggleProps {
  annual: boolean;
  onAnnualChange: (value: boolean) => void;
  className?: string;
}

export function FeatureToggle({ annual, onAnnualChange, className }: FeatureToggleProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center gap-3 mb-8 md:mb-10 p-4 rounded-2xl",
        "border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl",
        className,
      )}
    >
      <span className={cn("text-sm font-medium", annual ? "text-zinc-500" : "text-zinc-200")}>Monthly</span>
      <Switch
        checked={annual}
        onCheckedChange={onAnnualChange}
        className="data-[state=checked]:bg-emerald-600 data-[state=unchecked]:bg-zinc-700"
        aria-label="Toggle annual billing"
      />
      <span className={cn("text-sm font-medium", annual ? "text-zinc-200" : "text-zinc-500")}>
        Annual <span className="text-emerald-400/90">(20% off)</span>
      </span>
    </div>
  );
}
