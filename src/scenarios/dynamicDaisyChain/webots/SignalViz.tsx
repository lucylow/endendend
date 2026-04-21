import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface SignalVizProps {
  data: { t: number; q: number }[];
  title?: string;
  height?: number;
}

export function SignalViz({ data, title = "Ingress quality", height = 100 }: SignalVizProps) {
  return (
    <div className="w-full" style={{ height }}>
      <div className="mb-0.5 text-[10px] text-violet-200">{title}</div>
      <ResponsiveContainer width="100%" height={height - 16}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis dataKey="t" hide />
          <YAxis domain={[0, 1]} width={24} stroke="#889" fontSize={9} />
          <Tooltip contentStyle={{ background: "#111", border: "1px solid #444", fontSize: 11 }} />
          <Line type="monotone" dataKey="q" stroke="#7dd3fc" dot={false} strokeWidth={2} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
