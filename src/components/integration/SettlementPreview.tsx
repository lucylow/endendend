import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSettlementPreview } from "@/hooks/useSettlementPreview";
import { selectIsSettlementReady } from "@/lib/state/selectors";

export function SettlementPreview() {
  const { preview, sealSettlement, flat } = useSettlementPreview();
  const ready = selectIsSettlementReady(flat, preview);

  return (
    <Card className="border-zinc-800 bg-zinc-900/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Settlement (Arc preview)</CardTitle>
        <CardDescription className="text-xs">
          Seals manifest after mission is terminal (complete / aborted). Mock bridge hash when Arc is offline.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-[11px]">
        {preview ? (
          <>
            <div className="rounded-md border border-zinc-800 bg-zinc-950/60 p-2 font-mono">
              <div>ready: {String(ready)}</div>
              <div className="truncate">hash {preview.manifestHash}</div>
              {preview.settlementAmount && <div>amount {preview.settlementAmount}</div>}
              {preview.chainRef && <div>{preview.chainRef}</div>}
              {preview.operatorAddress && <div className="truncate text-sky-400/80">{preview.operatorAddress}</div>}
              {preview.mockLabeled && <div className="text-amber-400">simulated settlement path</div>}
            </div>
            <Button size="sm" disabled={!ready} onClick={() => void sealSettlement()}>
              Seal settlement
            </Button>
          </>
        ) : (
          <p className="text-zinc-500">No preview yet — run mission to terminal phase.</p>
        )}
      </CardContent>
    </Card>
  );
}
