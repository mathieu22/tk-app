"use client";
// Évolution mensuelle recettes / dépenses sur l'année scolaire (US-6.6).
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const fmt = (n: number) => `${n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} Ar`;
const short = (n: number) => (Math.abs(n) >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace(".0", "")} M` : Math.abs(n) >= 1000 ? `${Math.round(n / 1000)} k` : `${n}`);

export function TreasuryChart({ data }: { data: { label: string; income: number; expense: number }[] }) {
  return (
    <div className="h-64 w-full" role="img" aria-label="Recettes et dépenses par mois">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: -12, bottom: 0 }} barGap={2}>
          <CartesianGrid vertical={false} stroke="var(--gph-divider)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--gph-ink-3)" }} />
          <YAxis tickFormatter={short} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--gph-ink-3)" }} width={48} />
          <Tooltip formatter={(v) => fmt(Number(v))} cursor={{ fill: "var(--gph-track)" }}
            contentStyle={{ borderRadius: 12, border: "1px solid var(--gph-divider)", fontSize: 12 }} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="income" name="Recettes" fill="var(--gph-success)" radius={[4, 4, 0, 0]} maxBarSize={18} />
          <Bar dataKey="expense" name="Dépenses" fill="var(--gph-danger)" radius={[4, 4, 0, 0]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
