"use client";
// Barres mensuelles du taux de présence (US-2.4), couleur selon les seuils de l'association.
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Datum = { label: string; pct: number; present: number; total: number };

export function AttendanceBars({ data, green, orange }: { data: Datum[]; green: number; orange: number }) {
  const color = (d: Datum) => (!d.total ? "var(--gph-track)" : d.pct >= green ? "var(--gph-success)" : d.pct >= orange ? "var(--gph-warning)" : "var(--gph-danger)");
  return (
    <div className="h-40 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: -28 }}>
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--gph-ink-3)" }} axisLine={false} tickLine={false} interval={0} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "var(--gph-ink-3)" }} axisLine={false} tickLine={false} ticks={[0, 50, 100]} />
          <Tooltip cursor={{ fill: "var(--gph-track)" }}
            formatter={(_v, _n, item) => { const d = item.payload as Datum; return [d.total ? `${d.pct} % (${d.present}/${d.total})` : "Aucune séance", "Présence"]; }} />
          <Bar dataKey="pct" radius={[4, 4, 0, 0]}>
            {data.map((d) => <Cell key={d.label} fill={color(d)} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
