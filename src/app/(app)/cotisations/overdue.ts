// Membres en retard de cotisation (US-3.6).
import "server-only";
import { isMinor } from "@/lib/categories";
import { db } from "@/lib/db";
import { fullName } from "@/lib/domain";
import { formatAriary, schoolMonths } from "@/lib/format";
import { currentMonth } from "./data";
import { MONTH_SHORT } from "./months";

export type OverdueRow = Awaited<ReturnType<typeof overdueFor>>[number];

/**
 * Échéances en retard : Droit / Passport de l'année non soldés, Écolage non soldé
 * jusqu'au mois courant inclus, frais d'événements déjà commencés.
 * Destinataire : Tuteur 1 pour un mineur (s'il existe), sinon le membre.
 */
export async function overdueFor(schoolYear: string, memberIds?: string[]) {
  const order = schoolMonths();
  const elapsed = order.slice(0, order.indexOf(currentMonth()) + 1);
  const dues = await db.due.findMany({
    where: {
      status: { not: "PAID" },
      member: { archived: false, status: "ACTIVE", ...(memberIds ? { id: { in: memberIds } } : {}) },
      OR: [
        { schoolYear, feeType: { code: { in: ["DROIT", "PASSPORT"] } } },
        { schoolYear, feeType: { code: "ECOLAGE" }, month: { in: elapsed } },
        { feeType: { code: "EVENT" }, event: { cancelled: false, startDate: { lte: new Date() } } },
      ],
    },
    include: {
      feeType: { select: { code: true, label: true } },
      event: { select: { title: true } },
      member: {
        select: {
          id: true, firstName: true, lastName: true, phone: true, birthDate: true, photoUrl: true,
          parents: { where: { rank: 1 }, include: { parent: true } },
        },
      },
    },
  });

  const byMember = new Map<string, typeof dues>();
  for (const d of dues) byMember.set(d.memberId, [...(byMember.get(d.memberId) ?? []), d]);

  return [...byMember.values()].map((list) => {
    const member = list[0].member;
    const total = list.reduce((n, d) => n + Math.max(0, d.amountDue - d.amountPaid), 0);
    const ecolage = list.filter((d) => d.feeType.code === "ECOLAGE").sort((a, b) => order.indexOf(a.month) - order.indexOf(b.month));
    const parts = [
      ...list.filter((d) => d.feeType.code === "DROIT" || d.feeType.code === "PASSPORT").map((d) => d.feeType.label),
      ...(ecolage.length ? [`Écolage ${ecolage.map((d) => MONTH_SHORT[d.month]).join(", ")}`] : []),
      ...list.filter((d) => d.feeType.code === "EVENT").map((d) => d.event?.title ?? "Événement"),
    ];
    const tutor = isMinor(member.birthDate) ? member.parents[0]?.parent : undefined;
    const recipientName = tutor ? `${tutor.firstName} ${tutor.lastName}` : fullName(member);
    const recipientPhone = tutor?.phone ?? member.phone ?? null;
    const details = parts.join(", ");
    const message =
      `Bonjour ${recipientName}, sauf erreur de notre part, ${tutor ? `pour ${member.firstName}, ` : ""}` +
      `il reste ${formatAriary(total)} à régler (${details}). Merci de votre compréhension. — Le club`;
    return {
      memberId: member.id, member, total, details, count: list.length,
      recipientName, recipientPhone, recipientRole: tutor ? "Tuteur 1" : "Membre", message,
    };
  }).sort((a, b) => b.total - a.total);
}
