import type { Metadata } from "next";
import { SettingsColors } from "@/components/settings-colors";
import { DEFAULT_COLORS } from "@/components/settings-defaults";
import { SettingsHeader } from "@/components/settings-ui";
import { getAssociation, requirePermission } from "@/lib/dal";
import { THEME_VARS } from "@/lib/theme";

export const metadata: Metadata = { title: "Couleurs" };

export default async function ColorsPage() {
  await requirePermission("settings");
  const association = await getAssociation();
  let saved: Record<string, string> = {};
  try {
    saved = JSON.parse(association.colors || "{}");
  } catch {
    // JSON invalide : valeurs par défaut
  }
  const values = Object.fromEntries(Object.keys(THEME_VARS).map((k) => [k, saved[k] ?? DEFAULT_COLORS[k]]));
  return (
    <>
      <SettingsHeader title="Couleurs" sub="Personnalisez l'apparence de l'application" />
      <SettingsColors labels={THEME_VARS} initial={values} darkMode={association.darkMode} />
    </>
  );
}
