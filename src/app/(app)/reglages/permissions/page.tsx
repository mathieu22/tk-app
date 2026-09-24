import type { Metadata } from "next";
import { SettingsPermissions } from "@/components/settings-permissions";
import { SettingsHeader } from "@/components/settings-ui";
import { getAssociation, requirePermission } from "@/lib/dal";
import { DEFAULT_MATRIX, effectiveMatrix, PERMISSIONS } from "@/lib/permissions";

export const metadata: Metadata = { title: "Permissions" };

export default async function PermissionsPage() {
  await requirePermission("settings");
  const association = await getAssociation();
  return (
    <>
      <SettingsHeader title="Permissions" sub="Droits de chaque profil (spec §2.2). Les cases modifiées sont surlignées." />
      <SettingsPermissions labels={PERMISSIONS} matrix={effectiveMatrix(association.permissions)} defaults={DEFAULT_MATRIX} />
    </>
  );
}
