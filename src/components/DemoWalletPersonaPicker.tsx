import { DEMO_PERSONAS } from "@/wallet/demoPersonas";
import { cn } from "@/lib/utils";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

type Props = {
  value: string;
  onChange: (personaId: string) => void;
  disabled?: boolean;
  className?: string;
};

export function DemoWalletPersonaPicker({ value, onChange, disabled, className }: Props) {
  return (
    <RadioGroup
      value={value}
      onValueChange={onChange}
      disabled={disabled}
      className={cn("grid gap-2", className)}
      aria-label="Demo operator persona"
    >
      {DEMO_PERSONAS.map((p) => (
        <div
          key={p.id}
          className={cn(
            "flex gap-3 rounded-lg border p-3 transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ring-offset-background",
            value === p.id ? "border-amber-500/50 bg-amber-500/5" : "border-border/80 bg-muted/20",
          )}
        >
          <RadioGroupItem value={p.id} id={`persona-${p.id}`} className="mt-1 border-amber-500/60" />
          <div className="min-w-0 flex-1 space-y-1">
            <Label htmlFor={`persona-${p.id}`} className="flex cursor-pointer flex-wrap items-center gap-2 text-sm font-medium">
              <span aria-hidden>{p.emoji}</span>
              <span>{p.name}</span>
              <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                Mock
              </span>
            </Label>
            <p className="text-xs text-muted-foreground leading-relaxed">{p.roleLabel}</p>
            <p className="text-[11px] text-muted-foreground/90 line-clamp-2">{p.narrative}</p>
            <p className="font-mono text-[10px] text-amber-200/90">Demo balance · {p.mockBalance}</p>
          </div>
        </div>
      ))}
    </RadioGroup>
  );
}
