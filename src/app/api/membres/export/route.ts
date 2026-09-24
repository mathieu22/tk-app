// Export de l'annuaire dans le même format de colonnes que le fichier du club (US-2.6 S).
import { requireApiPermission } from "@/app/api/membres/_auth";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { xlsxResponse } from "@/lib/export";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireApiPermission("member.import");
  if (!auth.user) return auth.error;

  const members = await db.member.findMany({
    where: { archived: false },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    include: { parents: { orderBy: { rank: "asc" }, include: { parent: true } } },
  });

  const tutorText = (rank: 1 | 2) => (m: (typeof members)[number]) => {
    const l = m.parents.find((p) => p.rank === rank);
    return l ? `${l.parent.firstName} ${l.parent.lastName} ${l.parent.phone}` : "";
  };

  const rows = members.map((m) => ({
    Id: m.matricule,
    Noms: m.lastName,
    "Prénoms": m.firstName,
    Sexe: m.sex,
    Date_Naissance: formatDate(m.birthDate),
    Lieu_Naissance: m.birthPlace ?? "",
    Nationalite: m.nationality,
    Groupe_Sangin: m.bloodGroup ?? "",
    Adresse: m.address ?? "",
    Contact: m.phone ?? "",
    TUTEUR1: tutorText(1)(m),
    TUTEUR2: tutorText(2)(m),
    Mail: m.email ?? "",
    FB: m.facebook ?? "",
    Date_inscription: formatDate(m.joinedAt),
    Statut: m.status,
    Poste: m.position,
  }));

  return xlsxResponse(`membres-${new Date().toISOString().slice(0, 10)}.xlsx`, [
    {
      name: "Membres",
      columns: Object.keys(rows[0] ?? { Id: "" }).map((key) => ({ header: key, key })),
      rows,
    },
  ]);
}
