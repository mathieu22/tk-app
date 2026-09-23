// Calculs de présence des séances (US-1.1, US-1.4).
import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "./db";

/** Membres attendus à une séance : actifs, non archivés, du groupe de la séance (ou tous). */
export function expectedMembersWhere(groupId: string | null): Prisma.MemberWhereInput {
  return { status: "ACTIVE", archived: false, ...(groupId ? { groupId } : {}) };
}

/**
 * Présents / attendus / taux pour une liste de séances.
 * Le statut Excusé est retiré du total attendu (non compté comme absent, US-1.4).
 */
export async function sessionStats(sessions: { id: string; groupId: string | null }[]) {
  const ids = sessions.map((s) => s.id);
  const [counts, groupSizes, allActive] = await Promise.all([
    db.attendance.groupBy({ by: ["sessionId", "status"], where: { sessionId: { in: ids } }, _count: true }),
    db.member.groupBy({ by: ["groupId"], where: expectedMembersWhere(null), _count: true }),
    db.member.count({ where: expectedMembersWhere(null) }),
  ]);
  const sizeOf = (groupId: string | null) =>
    groupId ? (groupSizes.find((g) => g.groupId === groupId)?._count ?? 0) : allActive;

  return new Map(
    sessions.map((s) => {
      const of = (status: string) => counts.find((c) => c.sessionId === s.id && c.status === status)?._count ?? 0;
      const present = of("PRESENT");
      const excused = of("EXCUSED");
      // Garde-fou : des présents hors groupe (ajoutés sur confirmation) peuvent dépasser l'effectif.
      const total = Math.max(sizeOf(s.groupId) - excused, present);
      const pct = total ? Math.round((present / total) * 100) : 0;
      return [s.id, { present, excused, total, pct }];
    }),
  );
}
