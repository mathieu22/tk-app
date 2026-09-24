"use client";
// US-8.2 : montants des frais par année scolaire, avec tarifs par groupe (S).
import { Check, CopyPlus } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import { createNextYearTariffs, saveTariffs } from "@/app/actions/settings";
import { Card, FormMessage } from "./settings-ui";

type Fee = { code: string; label: string; periodicity: string; color: string; soft: string };

export function SettingsTariffs({ schoolYear, fees, groups, amounts, isLast }: {
  schoolYear: string; fees: Fee[]; groups: { id: string; name: string }[]; amounts: Record<string, number>; isLast: boolean;
}) {
  const [state, action, pending] = useActionState(saveTariffs, undefined);
  const [perGroup, setPerGroup] = useState(Object.keys(amounts).some((k) => !k.endsWith("_all")));
  const [copying, startCopy] = useTransition();
  const next = `${Number(schoolYear.slice(0, 4)) + 1}-${Number(schoolYear.slice(0, 4)) + 2}`;
  const val = (k: string) => state?.values?.[`amount_${k}`] ?? (amounts[k] !== undefined ? String(amounts[k]) : "");

  return (
    <form action={action} className="flex flex-col gap-4 px-4">
      <input type="hidden" name="schoolYear" value={schoolYear} />
      <div className="grid gap-4 lg:grid-cols-3">
        {fees.map((f) => (
          <Card key={f.code}>
            <div className="mb-3 flex items-center gap-2.5">
              <span className="h-3 w-3 rounded-full" style={{ background: f.color }} />
              <h2 className="m-0 text-[15px] font-bold">{f.label}</h2>
              <span className="text-xs font-semibold text-ink-3">{f.periodicity === "MONTHLY" ? "par mois" : "par an"}</span>
            </div>
            <label className="gph-label" htmlFor={`amount_${f.code}_all`}>Tarif général</label>
            <div className="relative">
              <input id={`amount_${f.code}_all`} name={`amount_${f.code}_all`} inputMode="numeric" pattern="[0-9 ]*"
                defaultValue={val(`${f.code}_all`)} placeholder="0" className="gph-input gph-amount pr-12 text-lg font-bold" style={{ color: f.color }} />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-ink-3">Ar</span>
            </div>
            {perGroup && groups.map((g) => (
              <div key={g.id} className="mt-2.5 flex items-center gap-2">
                <label htmlFor={`amount_${f.code}_${g.id}`} className="w-24 flex-none truncate text-[13px] font-semibold text-ink-2">{g.name}</label>
                <div className="relative flex-1">
                  <input id={`amount_${f.code}_${g.id}`} name={`amount_${f.code}_${g.id}`} inputMode="numeric" pattern="[0-9 ]*"
                    defaultValue={val(`${f.code}_${g.id}`)} placeholder="Tarif général" className="gph-input gph-amount py-2.5 pr-10 text-sm" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-ink-3">Ar</span>
                </div>
              </div>
            ))}
          </Card>
        ))}
      </div>

      <Card>
        <div className="flex flex-col gap-3">
          <label className="flex cursor-pointer items-center gap-3 text-sm font-medium">
            <input type="checkbox" checked={perGroup} onChange={(e) => setPerGroup(e.target.checked)} className="h-5 w-5 accent-[var(--gph-primary)]" />
            Tarifs différents par groupe d&apos;entraînement
          </label>
          <label className="flex cursor-pointer items-center gap-3 text-sm font-medium">
            <input type="checkbox" name="applyToUnpaid" className="h-5 w-5 accent-[var(--gph-primary)]" />
            Appliquer aux échéances {schoolYear} pas encore payées
          </label>
          <p className="text-xs text-ink-3">
            Sans cette option, les échéances déjà créées gardent leur montant ; le nouveau tarif s&apos;applique aux nouveaux membres.
            Un tarif de groupe vide reprend le tarif général.
          </p>
        </div>
      </Card>

      <FormMessage state={state} />
      <div className="flex flex-col gap-2 sm:flex-row">
        {isLast && (
          <button type="button" className="gph-btn-ghost flex-1" disabled={copying}
            onClick={() => startCopy(() => createNextYearTariffs(schoolYear))}>
            <CopyPlus size={16} /> Préparer {next}
          </button>
        )}
        <button className="gph-btn-primary flex-1" disabled={pending}>
          <Check size={16} strokeWidth={2.5} /> Enregistrer {schoolYear}
        </button>
      </div>
    </form>
  );
}
