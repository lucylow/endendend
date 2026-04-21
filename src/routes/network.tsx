import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useSwarmStore } from "@/store/swarmStore";
import { setNetworkFaultPacketLoss } from "@/store/networkFaultContext";
import { useP2PStore } from "@/store/p2pStore";

export const Route = createFileRoute("/network")({
  component: NetworkPage,
});

function NetworkPage() {
  const faultConfig = useSwarmStore((s) => s.faultConfig);
  const setFaultConfig = useSwarmStore((s) => s.setFaultConfig);
  const injectPartition = useP2PStore((s) => s.injectPartition);
  const mergePartitions = useP2PStore((s) => s.mergePartitions);
  const [partitionOn, setPartitionOn] = useState(false);

  const lossPct = Math.round((faultConfig.packetLoss ?? 0) * 100);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold text-white">Network emulation</h1>
      <Card className="border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-sm text-white">Link impairment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <div className="flex justify-between text-xs text-zinc-400">
              <Label>Packet loss</Label>
              <span>{lossPct}%</span>
            </div>
            <Slider
              value={[lossPct]}
              min={0}
              max={80}
              step={1}
              onValueChange={(v) => {
                setNetworkFaultPacketLoss(v[0] / 100);
                setFaultConfig({ packetLoss: v[0] / 100 });
              }}
              className="mt-2"
            />
          </div>
          <div>
            <div className="flex justify-between text-xs text-zinc-400">
              <Label>Latency</Label>
              <span>{faultConfig.latencyMs} ms</span>
            </div>
            <Slider
              value={[faultConfig.latencyMs]}
              min={0}
              max={500}
              step={5}
              onValueChange={(v) => setFaultConfig({ latencyMs: v[0] })}
              className="mt-2"
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs text-zinc-400">Partition (demo inject)</Label>
            <Switch
              checked={partitionOn}
              onCheckedChange={(on) => {
                setPartitionOn(on);
                if (on) injectPartition(["agent-2", "agent-3"]);
                else mergePartitions();
              }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
