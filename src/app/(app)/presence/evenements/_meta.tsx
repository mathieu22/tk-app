// Libellés et icônes des événements (US-1.6, 1.7).
import { Award, CalendarDays, Dumbbell, PartyPopper, Sparkles, Trophy, Users, type LucideProps } from "lucide-react";
import { formatDate } from "@/lib/format";

export const AUDIENCES = {
  ALL: "Tous les membres",
  GROUPS: "Un ou plusieurs groupes",
  SELECTION: "Sélection d'athlètes",
  BOARD: "Membres du bureau",
  PARENTS: "Parents",
} as const;

export const MODES = {
  SUMMONS: { label: "Convocation", hint: "Participants désignés d'office" },
  REGISTRATION: { label: "Inscription libre", hint: "Réponse des membres / parents jusqu'à une date limite" },
  OPEN: { label: "Ouvert", hint: "Pas d'inscription, seule la présence est pointée" },
} as const;

export const RESPONSES = {
  YES: { label: "Participe", tone: "success" },
  NO: { label: "Ne participe pas", tone: "danger" },
  MAYBE: { label: "Peut-être", tone: "warning" },
  PENDING: { label: "En attente", tone: "neutral" },
} as const;

const ICONS = { dumbbell: Dumbbell, award: Award, trophy: Trophy, sparkles: Sparkles, users: Users, "party-popper": PartyPopper };

export function EventTypeIcon({ icon, ...props }: LucideProps & { icon: string }) {
  const C = ICONS[icon as keyof typeof ICONS] ?? CalendarDays;
  return <C {...props} />;
}

/** « 12/10/2026 » ou « 12/10/2026 → 14/10/2026 » */
export function eventDates(e: { startDate: Date; endDate: Date }) {
  return e.endDate.getTime() > e.startDate.getTime() ? `${formatDate(e.startDate)} → ${formatDate(e.endDate)}` : formatDate(e.startDate);
}

/** Texte de partage WhatsApp / SMS (US-1.10). */
export function shareText(e: { title: string; startDate: Date; endDate: Date; location: string | null; description?: string | null }, time?: string | null) {
  return [
    `📅 ${e.title}`,
    `Date : ${eventDates(e)}${time ? ` à ${time.replace(":", "h")}` : ""}`,
    e.location ? `Lieu : ${e.location}` : null,
    e.description ? e.description.slice(0, 280) : null,
  ].filter(Boolean).join("\n");
}
