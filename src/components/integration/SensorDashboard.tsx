import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FlatMissionEnvelope } from "@/lib/state/types";

type Row = { label: string; value: string; hint?: string };

export function SensorDashboard({ envelope }: { envelope: FlatMissionEnvelope }) {
  const sim = envelope.simulation;
  const firstId = envelope.nodes[0]?.nodeId;
  const tel = firstId && sim?.telemetryByNode ? sim.telemetryByNode[firstId] : undefined;

  const rows: Row[] = tel
    ? pickRowsForScenario(envelope.scenario, tel.sensors, tel.confidence)
    : [{ label: "Status", value: "No telemetry", hint: "Select a mission with active nodes" }];

  return (
    <Card className="border-violet-500/15 bg-violet-500/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Sensor board ({envelope.scenario.replaceAll("_", " ")})</CardTitle>
        <p className="text-[11px] text-zinc-500 font-mono">Node {firstId ?? "—"} · {tel?.confidence ?? "—"}</p>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.label} className="rounded-lg border border-zinc-800/80 bg-zinc-950/50 px-2 py-2">
            <div className="text-[10px] uppercase tracking-wide text-zinc-500">{r.label}</div>
            <div className="mt-0.5 font-mono text-sm text-zinc-100">{r.value}</div>
            {r.hint ? <div className="mt-0.5 text-[10px] text-zinc-600">{r.hint}</div> : null}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function pickRowsForScenario(
  scenario: string,
  s: import("@/mock/types").SensorReadings,
  conf: string,
): Row[] {
  const base: Row[] = [
    { label: "Confidence", value: conf },
    { label: "Link / GPS", value: `${(s.linkQuality * 100).toFixed(0)}% / ${(s.gpsFix * 100).toFixed(0)}%` },
  ];
  if (scenario === "wildfire") {
    return [
      ...base,
      { label: "Thermal", value: `${s.thermalC.toFixed(1)} °C`, hint: `thermal conf ${(s.thermalConfidence * 100).toFixed(0)}%` },
      { label: "Smoke / IR", value: `${(s.smokeDensity * 100).toFixed(0)}% / ${(s.irReflectance * 100).toFixed(0)}%` },
    ];
  }
  if (scenario === "tunnel") {
    return [
      ...base,
      { label: "Lidar / IMU", value: `${(s.lidarConfidence * 100).toFixed(0)}% / vib ${(s.imuVibration * 100).toFixed(0)}%` },
      { label: "Audio", value: `${(s.audioConfidence * 100).toFixed(0)}%` },
    ];
  }
  if (scenario === "flood_rescue") {
    return [
      ...base,
      { label: "Moisture / Battery", value: `${(s.moisture * 100).toFixed(0)}% / ${(s.battery * 100).toFixed(0)}%` },
      { label: "Speed", value: `${s.speedMps.toFixed(1)} m/s` },
    ];
  }
  if (scenario === "hazmat") {
    return [
      ...base,
      { label: "Gas / Geofence", value: `${s.gasPpm.toFixed(1)} ppm · ${s.geofenceStatus}` },
      { label: "Thermal", value: `${s.thermalC.toFixed(1)} °C` },
    ];
  }
  return [
    ...base,
    { label: "Thermal / Optical", value: `${s.thermalC.toFixed(1)}°C / ${(s.opticalConfidence * 100).toFixed(0)}%` },
    { label: "IMU / LiDAR", value: `${(s.imuVibration * 100).toFixed(0)}% / ${(s.lidarConfidence * 100).toFixed(0)}%` },
  ];
}
