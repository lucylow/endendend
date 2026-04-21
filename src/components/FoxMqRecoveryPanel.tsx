import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  mergeConflicts: number;
  duplicateDrops: number;
  ledgerEvents: number;
};

export function FoxMqRecoveryPanel({ mergeConflicts, duplicateDrops, ledgerEvents }: Props) {
  return (
    <Card className="border-border/60 bg-card/25">
      <CardHeader className="py-3">
        <CardTitle className="text-sm">FoxMQ recovery & dedup</CardTitle>
      </CardHeader>
      <CardContent className="text-xs text-muted-foreground space-y-1">
        <div>
          Merge conflicts resolved (cumulative): <span className="text-foreground font-mono">{mergeConflicts}</span>
        </div>
        <div>
          Duplicate deltas dropped: <span className="text-foreground font-mono">{duplicateDrops}</span>
        </div>
        <div>
          Ledger events: <span className="text-foreground font-mono">{ledgerEvents}</span>
        </div>
      </CardContent>
    </Card>
  );
}
