"use client";
// Courbe d'évolution du poids (US-5.5).
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function PalmaresWeighInChart({ data }: { data: { date: string; kg: number }[] }) {
  if (data.length < 2) return null;
  return (
    <div style={{ height: 160 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ left: -20, right: 12, top: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--gph-divider)" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--gph-ink-3)" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: "var(--gph-ink-3)" }} axisLine={false} tickLine={false} width={36} domain={["dataMin - 2", "dataMax + 2"]} />
          <Tooltip formatter={(v) => [`${v} kg`, "Poids"]} contentStyle={{ borderRadius: 10, border: "1px solid var(--gph-divider)", fontSize: 12 }} />
          <Line type="monotone" dataKey="kg" stroke="var(--gph-primary)" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
