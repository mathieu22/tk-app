import type { Metadata } from "next";
import Link from "next/link";
import { SettingsTariffs } from "@/components/settings-tariffs";
import { SettingsHeader } from "@/components/settings-ui";
import { db } from "@/lib/db";
import { getAssociation, requirePermission } from "@/lib/dal";
import { FEE_META, RECURRING_FEES } from "@/lib/domain";

export const metadata: Metadata = { title: "Montants" };

export default async function TariffsPage(props: PageProps<"/reglages/montants">) {
  await requirePermission("settings");
  const association = await getAssociation();
  const sp = await props.searchParams;

  const years = [...new Set((await db.tariff.findMany({ select: { schoolYear: true } })).map((t) => t.schoolYear))];
  if (!years.includes(association.currentSchoolYear)) years.push(association.currentSchoolYear);
  years.sort();
  const year = typeof sp.annee === "string" && /^\d{4}-\d{4}$/.test(sp.annee) ? sp.annee : association.currentSchoolYear;
  if (!years.includes(year)) years.push(year);

  const [feeTypes, groups, tariffs] = await Promise.all([
    db.feeType.findMany({ where: { code: { in: [...RECURRING_FEES] } } }),
    db.group.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.tariff.findMany({ where: { schoolYear: year } }),
  ]);
  const fees = RECURRING_FEES.map((code) => feeTypes.find((f) => f.code === code)).filter((f) => !!f).map((f) => ({
    code: f.code, label: f.label, periodicity: f.periodicity, color: FEE_META[f.code as keyof typeof FEE_META].color,
    soft: FEE_META[f.code as keyof typeof FEE_META].soft,
  }));
  const amounts: Record<string, number> = {};
  for (const t of tariffs) {
    const code = feeTypes.find((f) => f.id === t.feeTypeId)?.code;
    if (code) amounts[`${code}_${t.groupId ?? "all"}`] = t.amount;
  }

  return (
    <>
      <SettingsHeader title="Montants" sub="Tarifs des cotisations par année scolaire" />
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-3">
        {years.map((y) => (
          <Link key={y} href={`/reglages/montants?annee=${y}`} replace className={`gph-chip${y === year ? " active" : ""}`}>
            {y}
            {y === association.currentSchoolYear && <span className="count">en cours</span>}
          </Link>
        ))}
      </div>
      <SettingsTariffs key={year} schoolYear={year} fees={fees} groups={groups} amounts={amounts}
        isLast={year === years[years.length - 1]} />
    </>
  );
}
