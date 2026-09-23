// Couleurs personnalisées (US-8.1) : l'association stocke { "--gph-primary": "#1B5E20", … }.
import "server-only";
import { db } from "./db";

/** Variables CSS surchargeables depuis les Réglages, avec leur libellé. */
export const THEME_VARS = {
  "--gph-primary": "Couleur principale",
  "--gph-primary-deep": "Couleur principale foncée",
  "--gph-primary-soft": "Couleur principale claire",
  "--gph-accent": "Accent",
  "--gph-droit": "Droit",
  "--gph-droit-soft": "Droit (fond)",
  "--gph-passport": "Passport",
  "--gph-passport-soft": "Passport (fond)",
  "--gph-ecolage": "Écolage",
  "--gph-ecolage-soft": "Écolage (fond)",
  "--gph-success": "Payé / présence élevée",
  "--gph-warning": "Partiel / présence moyenne",
  "--gph-danger": "Non payé / présence faible",
} as const;

/** CSS injecté dans <head> ; valeurs filtrées (#RGB / #RRGGBB uniquement) pour éviter toute injection. */
export async function themeCss() {
  try {
    const a = await db.association.findFirst({ select: { colors: true, darkMode: true } });
    if (!a) return { css: "", dark: false };
    const colors = JSON.parse(a.colors || "{}") as Record<string, string>;
    const decls = Object.entries(colors)
      .filter(([k, v]) => k in THEME_VARS && /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(v))
      .map(([k, v]) => `${k}:${v}`)
      .join(";");
    return { css: decls ? `:root{${decls}}` : "", dark: a.darkMode };
  } catch {
    return { css: "", dark: false };
  }
}
