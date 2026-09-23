// Matrice des permissions (spec §2.2), surchargeable par l'administrateur (EPIC 8).
import type { Profile } from "./domain";

export const PERMISSIONS = {
  "session.manage": "Créer une session / scanner",
  "attendance.viewAll": "Consulter les présences (tous)",
  "member.view": "Consulter l'annuaire",
  "member.edit": "Ajouter / modifier un membre",
  "member.delete": "Supprimer (archiver) un membre",
  "member.hardDelete": "Suppression définitive d'un membre",
  "member.import": "Importer / exporter l'annuaire",
  "payment.create": "Enregistrer un paiement",
  "payment.viewAll": "Consulter les cotisations (tous)",
  "payment.cancel": "Annuler un paiement",
  "event.manage": "Créer / gérer les événements",
  "grade.manage": "Gérer les grades",
  "palmares.manage": "Gérer le palmarès",
  "treasury.view": "Consulter la trésorerie",
  "treasury.manage": "Saisir en trésorerie",
  "expense.approve": "Valider les dépenses",
  "parent.manage": "Gérer les comptes parents",
  "user.manage": "Gérer les utilisateurs",
  "audit.view": "Consulter le journal d'audit",
  settings: "Réglages",
} as const;
export type Permission = keyof typeof PERMISSIONS;

const STAFF: Profile[] = ["ADMIN", "PRESIDENT", "SECRETARY", "TREASURER", "COACH"];

export const DEFAULT_MATRIX: Record<Permission, Profile[]> = {
  "session.manage": STAFF,
  "attendance.viewAll": STAFF,
  "member.view": STAFF,
  "member.edit": ["ADMIN", "PRESIDENT", "SECRETARY"],
  "member.delete": ["ADMIN", "PRESIDENT"],
  "member.hardDelete": ["ADMIN"],
  "member.import": ["ADMIN"],
  "payment.create": ["ADMIN", "PRESIDENT", "TREASURER"],
  "payment.viewAll": ["ADMIN", "PRESIDENT", "SECRETARY", "TREASURER"],
  "payment.cancel": ["ADMIN", "TREASURER"],
  "event.manage": ["ADMIN", "PRESIDENT", "SECRETARY", "TREASURER"],
  "grade.manage": ["ADMIN", "PRESIDENT", "SECRETARY", "COACH"],
  "palmares.manage": ["ADMIN", "PRESIDENT", "SECRETARY", "COACH"],
  "treasury.view": ["ADMIN", "PRESIDENT", "TREASURER"],
  "treasury.manage": ["ADMIN", "TREASURER"],
  "expense.approve": ["ADMIN", "PRESIDENT"],
  "parent.manage": ["ADMIN", "PRESIDENT", "SECRETARY"],
  "user.manage": ["ADMIN"],
  "audit.view": ["ADMIN"],
  settings: ["ADMIN"],
};

/** Permissions jamais retirables à l'administrateur (évite de se verrouiller dehors). */
const LOCKED_FOR_ADMIN: Permission[] = ["settings", "user.manage"];

/** Matrice effective : défaut + surcharges JSON `{ "member.edit": ["ADMIN", …] }` de l'association. */
export function effectiveMatrix(overridesJson: string | null | undefined): Record<Permission, Profile[]> {
  const matrix = { ...DEFAULT_MATRIX };
  try {
    const o = JSON.parse(overridesJson || "{}") as Record<string, string[]>;
    for (const [perm, profiles] of Object.entries(o)) {
      if (perm in matrix && Array.isArray(profiles)) matrix[perm as Permission] = profiles as Profile[];
    }
  } catch {
    // JSON invalide : matrice par défaut
  }
  for (const p of LOCKED_FOR_ADMIN) if (!matrix[p].includes("ADMIN")) matrix[p] = [...matrix[p], "ADMIN"];
  return matrix;
}

export function permissionsFor(profile: string, overridesJson?: string | null): Permission[] {
  const m = effectiveMatrix(overridesJson);
  return (Object.keys(m) as Permission[]).filter((p) => m[p].includes(profile as Profile));
}

/**
 * `can(user, "member.edit")` avec l'utilisateur renvoyé par getCurrentUser (permissions effectives),
 * ou `can("ADMIN", …)` pour la matrice par défaut.
 */
export function can(subject: string | { perms: Permission[] } | undefined | null, permission: Permission): boolean {
  if (!subject) return false;
  if (typeof subject === "string") return DEFAULT_MATRIX[permission].includes(subject as Profile);
  return subject.perms.includes(permission);
}

export const STAFF_PROFILES = STAFF;
export const isStaff = (profile: string) => STAFF.includes(profile as Profile);
