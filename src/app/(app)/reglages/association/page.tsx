import type { Metadata } from "next";
import { SettingsAssociationForm } from "@/components/settings-association-form";
import { SettingsHeader } from "@/components/settings-ui";
import { getAssociation, requirePermission } from "@/lib/dal";

export const metadata: Metadata = { title: "Association" };

export default async function AssociationPage() {
  await requirePermission("settings");
  const a = await getAssociation();
  return (
    <>
      <SettingsHeader title="Association" sub="Informations affichées sur les reçus et paramètres généraux" />
      <SettingsAssociationForm
        values={{
          name: a.name, logoUrl: a.logoUrl ?? "", address: a.address ?? "", phone: a.phone ?? "", email: a.email ?? "",
          receiptFooter: a.receiptFooter ?? "", currentSchoolYear: a.currentSchoolYear, schoolYearStartMon: a.schoolYearStartMon,
          newMemberDays: a.newMemberDays, thresholdGreen: a.thresholdGreen, thresholdOrange: a.thresholdOrange,
          poomToDanAge: a.poomToDanAge, weightAlertKg: a.weightAlertKg, weighInMaxDays: a.weighInMaxDays,
          expenseApprovalMin: a.expenseApprovalMin,
        }}
      />
    </>
  );
}
