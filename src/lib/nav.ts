// Modules de l'application (spec §3). Filtrés par permission côté serveur.
import type { Permission } from "./permissions";

export type NavItem = { href: string; label: string; icon: string; description?: string };

type Module = NavItem & { permission: Permission };

/** Onglets principaux (barre du bas sur téléphone). */
export const PRIMARY: Module[] = [
  { href: "/presence", label: "Présence", icon: "calendar-check-2", permission: "attendance.viewAll" },
  { href: "/membres", label: "Membres", icon: "users", permission: "member.view" },
  { href: "/cotisations", label: "Cotisations", icon: "wallet", permission: "payment.viewAll" },
];

/** Modules secondaires (onglet « Plus » sur téléphone, barre latérale sur ordinateur). */
export const SECONDARY: Module[] = [
  { href: "/calendrier", label: "Calendrier", icon: "calendar-days", permission: "attendance.viewAll", description: "Séances et événements du mois" },
  { href: "/grades", label: "Grades", icon: "award", permission: "grade.manage", description: "Grilles, passages, examens" },
  { href: "/palmares", label: "Palmarès", icon: "trophy", permission: "palmares.manage", description: "Compétitions, résultats, catégories" },
  { href: "/tresorerie", label: "Trésorerie", icon: "landmark", permission: "treasury.view", description: "Comptes, recettes, dépenses, bilans" },
  { href: "/parents", label: "Parents", icon: "heart-handshake", permission: "parent.manage", description: "Comptes parents et invitations" },
  { href: "/reglages", label: "Réglages", icon: "settings", permission: "settings", description: "Association, couleurs, montants, utilisateurs" },
];

export function navFor(perms: Permission[]) {
  const allowed = (m: Module) => perms.includes(m.permission);
  const strip = (m: Module): NavItem => ({ href: m.href, label: m.label, icon: m.icon, description: m.description });
  return { primary: PRIMARY.filter(allowed).map(strip), secondary: SECONDARY.filter(allowed).map(strip) };
}
