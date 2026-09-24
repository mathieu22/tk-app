"use client";
// Répartition des athlètes par grade (US-4.5).
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function GradeDistributionChart({ data }: { data: { label: string; count: number; color: string }[] }) {
  if (!data.length) return <p className="py-6 text-center text-sm text-ink-3">Aucun grade enregistré.</p>;
  return (
    <div style={{ height: Math.max(180, data.length * 28) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
          <CartesianGrid horizontal={false} stroke="var(--gph-divider)" />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "var(--gph-ink-3)" }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="label" width={130} tick={{ fontSize: 11, fill: "var(--gph-ink-2)" }} axisLine={false} tickLine={false} />
          <Tooltip cursor={{ fill: "var(--gph-track)" }} formatter={(v) => [`${v} athlète(s)`, "Effectif"]}
            contentStyle={{ borderRadius: 10, border: "1px solid var(--gph-divider)", fontSize: 12 }} />
          <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={16}>
            {data.map((d) => <Cell key={d.label} fill={d.color} stroke="rgba(0,0,0,0.15)" />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
