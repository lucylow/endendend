import { useId } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { HealthHistoryPoint } from "@/features/health/types";

export interface DegradationTimelineProps {
  data: HealthHistoryPoint[];
  className?: string;
}

export function DegradationTimeline({ data, className }: DegradationTimelineProps) {
  const gradId = `healthScoreFill-${useId().replace(/:/g, "")}`;
  const chartData = data.map((p) => ({
    t: new Date(p.t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    score: p.score,
    status: p.status,
  }));

  if (chartData.length === 0) {
    return (
      <div className={className}>
        <p className="rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-8 text-center text-xs text-zinc-500">
          No health history yet — run the sim or connect telemetry.
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="h-40 w-full min-w-0 rounded-xl border border-zinc-800/90 bg-zinc-950/50 p-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis dataKey="t" tick={{ fill: "#71717a", fontSize: 9 }} tickLine={false} axisLine={false} />
            <YAxis domain={[0, 100]} tick={{ fill: "#71717a", fontSize: 9 }} tickLine={false} axisLine={false} width={28} />
            <Tooltip
              contentStyle={{
                background: "rgba(9,9,11,0.94)",
                border: "1px solid #3f3f46",
                borderRadius: 8,
                fontSize: 11,
              }}
              labelStyle={{ color: "#a1a1aa" }}
            />
            <Area type="monotone" dataKey="score" stroke="#22d3ee" fill={`url(#${gradId})`} strokeWidth={1.5} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
