// Valeurs métier (stockées en String dans la base) et libellés français.

export const POSITIONS = {
  PRESIDENT: "Président",
  VICE_PRESIDENT: "Vice-président",
  SECRETARY: "Secrétaire",
  TREASURER: "Trésorier",
  COACH: "Entraîneur",
  ATHLETE: "Athlète",
} as const;
export type Position = keyof typeof POSITIONS;
export const BOARD_POSITIONS: Position[] = ["PRESIDENT", "VICE_PRESIDENT", "SECRETARY", "TREASURER"];

export const MEMBER_STATUSES = {
  ACTIVE: "Actif",
  INACTIVE: "Inactif",
  SUSPENDED: "Suspendu",
  FORMER: "Ancien membre",
} as const;
export type MemberStatus = keyof typeof MEMBER_STATUSES;

export const SEXES = { M: "Masculin", F: "Féminin" } as const;
export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Inconnu"] as const;

export const PROFILES = ["ADMIN", "PRESIDENT", "SECRETARY", "TREASURER", "COACH", "ATHLETE", "PARENT"] as const;
export type Profile = (typeof PROFILES)[number];

export const PAYMENT_METHODS = {
  CASH: { label: "Espèces", icon: "banknote" },
  MOBILE_MONEY: { label: "Mobile Money", icon: "smartphone" },
  TRANSFER: { label: "Virement", icon: "building-2" },
} as const;
export type PaymentMethod = keyof typeof PAYMENT_METHODS;
export const OPERATORS = { MVOLA: "MVola", ORANGE_MONEY: "Orange Money", AIRTEL_MONEY: "Airtel Money" } as const;

export type DueStatus = "PAID" | "PARTIAL" | "UNPAID";
export const DUE_STATUS_META: Record<DueStatus, { label: string; icon: string; tone: "success" | "warning" | "danger" }> = {
  PAID: { label: "Payé", icon: "check", tone: "success" },
  PARTIAL: { label: "Partiel", icon: "clock", tone: "warning" },
  UNPAID: { label: "Non payé", icon: "x", tone: "danger" },
};

/** Catégories de frais (design : icône + couleurs CSS). */
export const FEE_META = {
  DROIT: { slug: "droit", sublabel: "Droit d'inscription", icon: "file-text", color: "var(--gph-droit)", soft: "var(--gph-droit-soft)" },
  PASSPORT: { slug: "passport", sublabel: "Carte annuelle", icon: "credit-card", color: "var(--gph-passport)", soft: "var(--gph-passport-soft)" },
  ECOLAGE: { slug: "ecolage", sublabel: "Cotisation mensuelle", icon: "graduation-cap", color: "var(--gph-ecolage)", soft: "var(--gph-ecolage-soft)" },
  EVENT: { slug: "evenement", sublabel: "Frais d'événement", icon: "calendar-days", color: "var(--gph-event)", soft: "var(--gph-event-soft)" },
} as const;
export type FeeCode = keyof typeof FEE_META;
export const FEE_BY_SLUG: Record<string, FeeCode> = { droit: "DROIT", passport: "PASSPORT", ecolage: "ECOLAGE", evenement: "EVENT" };
/** Types de cotisations récurrentes (hors frais d'événement). */
export const RECURRING_FEES = ["DROIT", "PASSPORT", "ECOLAGE"] as const satisfies readonly FeeCode[];

export type Tone = "success" | "warning" | "danger";
/** Couleur du taux de présence (seuils paramétrables, 80 / 50 par défaut). */
export function pctTone(pct: number, green = 80, orange = 50): Tone {
  if (pct >= green) return "success";
  if (pct >= orange) return "warning";
  return "danger";
}

export function fullName(m: { firstName: string; lastName: string }) {
  return `${m.firstName} ${m.lastName}`;
}
