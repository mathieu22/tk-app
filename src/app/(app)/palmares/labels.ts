// Libellés et fonctions pures du module Palmarès — sans accès base, importable côté client
// (voir data.ts pour les fonctions serveur ; séparé pour ne pas entraîner `db` dans le bundle client).

export const LEVELS = { LOCAL: "Local", REGIONAL: "Régional", NATIONAL: "National", INTERNATIONAL: "International" } as const;
export type Level = keyof typeof LEVELS;
export const LEVEL_ORDER: Level[] = ["INTERNATIONAL", "NATIONAL", "REGIONAL", "LOCAL"];

export const KINDS = { INDIVIDUAL: "Individuel", TEAM: "Équipe" } as const;

export const DISCIPLINES = {
  KYORUGI: "Kyorugi (combat)",
  POOMSAE_IND: "Poomsae individuel",
  POOMSAE_PAIR: "Poomsae paire",
  POOMSAE_TEAM: "Poomsae équipe",
  POOMSAE_FREESTYLE: "Poomsae freestyle",
  KYUKPA: "Kyukpa (casse)",
} as const;
export type Discipline = keyof typeof DISCIPLINES;

export const OUTCOMES = {
  GOLD: { label: "Or", emoji: "🥇", color: "#D4A017" },
  SILVER: { label: "Argent", emoji: "🥈", color: "#9CA3AF" },
  BRONZE: { label: "Bronze", emoji: "🥉", color: "#B87333" },
  RANK: { label: "Classé", emoji: "", color: "var(--gph-ink-2)" },
  PARTICIPATION: { label: "Participation", emoji: "", color: "var(--gph-ink-3)" },
  ELIMINATED: { label: "Éliminé", emoji: "", color: "var(--gph-ink-3)" },
} as const;
export type Outcome = keyof typeof OUTCOMES;
export const MEDALS: Outcome[] = ["GOLD", "SILVER", "BRONZE"];

export function outcomeLabel(r: { outcome: string; rank: number | null }) {
  const o = OUTCOMES[r.outcome as Outcome];
  if (r.outcome === "RANK") return r.rank ? `${r.rank}e place` : "Classé";
  return o ? `${o.emoji ? `${o.emoji} ` : ""}${o.label}` : r.outcome;
}

/** Valeur de tri d'un résultat (meilleur d'abord). */
export function resultScore(r: { outcome: string; rank: number | null }) {
  if (r.outcome === "GOLD") return 1;
  if (r.outcome === "SILVER") return 2;
  if (r.outcome === "BRONZE") return 3;
  if (r.outcome === "RANK") return r.rank ?? 50;
  if (r.outcome === "PARTICIPATION") return 90;
  return 99;
}

export function medalCounts(results: { outcome: string }[]) {
  return {
    gold: results.filter((r) => r.outcome === "GOLD").length,
    silver: results.filter((r) => r.outcome === "SILVER").length,
    bronze: results.filter((r) => r.outcome === "BRONZE").length,
  };
}

export type Fight = { opponent: string; score: string; round: string };
export function parseFights(json: string): Fight[] {
  try {
    const v = JSON.parse(json || "[]");
    return Array.isArray(v) ? v.filter((f) => f && typeof f === "object").slice(0, 20) : [];
  } catch {
    return [];
  }
}

/** « Rakoto H. » : prénom + initiale du nom (vitrine publique, pas de données sensibles). */
export function publicName(m: { firstName: string; lastName: string }) {
  return `${m.firstName.split(/\s+/)[0]} ${m.lastName.charAt(0)}.`;
}
