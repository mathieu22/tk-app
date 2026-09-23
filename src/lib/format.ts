// Formats imposés par la spec (§1 Contraintes générales).

/** 25000 → "25 000 Ar" */
export function formatAriary(amount: number): string {
  const n = Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${n} Ar`;
}

const MOBILE_PREFIXES = ["32", "33", "34", "37", "38"];

/**
 * Normalise un numéro malgache en "+261XXXXXXXXX".
 * Accepte "034 12 345 67", "+261 34 12 345 67", "261341234567", "341234567".
 * Retourne null si le numéro est invalide.
 */
export function normalizePhone(input: string): string | null {
  let digits = input.replace(/[^\d+]/g, "");
  if (digits.startsWith("+261")) digits = digits.slice(4);
  else if (digits.startsWith("261") && digits.length === 12) digits = digits.slice(3);
  else if (digits.startsWith("0") && digits.length === 10) digits = digits.slice(1);
  if (!/^\d{9}$/.test(digits)) return null;
  if (!MOBILE_PREFIXES.includes(digits.slice(0, 2))) return null;
  return `+261${digits}`;
}

/** "+261341234567" → "+261 34 12 345 67" */
export function formatPhone(e164: string): string {
  const d = e164.replace(/^\+261/, "");
  if (d.length !== 9) return e164;
  return `+261 ${d.slice(0, 2)} ${d.slice(2, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
}

/** Date → "JJ/MM/AAAA" */
export function formatDate(date: Date): string {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${date.getFullYear()}`;
}

/** Année scolaire (septembre → août) contenant la date : "2025-2026" */
export function schoolYearOf(date: Date, startMonth = 9): string {
  const y = date.getFullYear();
  const start = date.getMonth() + 1 >= startMonth ? y : y - 1;
  return `${start}-${start + 1}`;
}

/** Mois de l'année scolaire dans l'ordre : [9, 10, 11, 12, 1, …, 8] */
export function schoolMonths(startMonth = 9): number[] {
  return Array.from({ length: 12 }, (_, i) => ((startMonth - 1 + i) % 12) + 1);
}

export const MONTH_LABELS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

