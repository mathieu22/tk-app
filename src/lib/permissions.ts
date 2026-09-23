// Matrice des permissions (spec §2.2).
import type { Profile } from "./domain";

export type Permission =
  | "session.manage" // créer une session / scanner
  | "attendance.viewAll"
  | "member.edit"
  | "member.delete"
  | "payment.create"
  | "payment.viewAll"
  | "settings";

const MATRIX: Record<Permission, Profile[]> = {
  "session.manage": ["ADMIN", "PRESIDENT", "SECRETARY", "TREASURER", "COACH"],
  "attendance.viewAll": ["ADMIN", "PRESIDENT", "SECRETARY", "TREASURER", "COACH"],
  "member.edit": ["ADMIN", "PRESIDENT", "SECRETARY"],
  "member.delete": ["ADMIN", "PRESIDENT"],
  "payment.create": ["ADMIN", "PRESIDENT", "TREASURER"],
  "payment.viewAll": ["ADMIN", "PRESIDENT", "SECRETARY", "TREASURER"],
  settings: ["ADMIN"],
};

export function can(profile: string | undefined, permission: Permission): boolean {
  return !!profile && MATRIX[permission].includes(profile as Profile);
}

export const STAFF_PROFILES: Profile[] = ["ADMIN", "PRESIDENT", "SECRETARY", "TREASURER", "COACH"];
