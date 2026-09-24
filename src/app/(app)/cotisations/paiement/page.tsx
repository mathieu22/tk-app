import type { Metadata } from "next";
import { getMemberDues } from "@/app/actions/payments";
import { FormTopBar } from "@/components/ui";
import { db } from "@/lib/db";
import { getAssociation, requirePermission } from "@/lib/dal";
import { FEE_BY_SLUG, fullName, POSITIONS, type Position } from "@/lib/domain";
import { ensureDues } from "@/lib/fees";
import { formatPhone } from "@/lib/format";
import { PaymentForm } from "./payment-form";

export const metadata: Metadata = { title: "Nouveau paiement" };

export default async function NewPayment({ searchParams }: PageProps<"/cotisations/paiement">) {
  await requirePermission("payment.create");
  const { currentSchoolYear } = await getAssociation();
  await ensureDues(currentSchoolYear);

  const sp = await searchParams;
  const members = await db.member.findMany({
    where: { archived: false, status: "ACTIVE" },
    select: { id: true, matricule: true, firstName: true, lastName: true, position: true, phone: true, photoUrl: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const memberId = typeof sp.membre === "string" && members.some((m) => m.id === sp.membre) ? sp.membre : null;
  const feeCode = (typeof sp.type === "string" && FEE_BY_SLUG[sp.type]) || "ECOLAGE";
  const month = Number(sp.mois);

  return (
    <div>
      <FormTopBar cancelHref={feeCode === "EVENT" && typeof sp.evenement === "string" ? `/cotisations/evenements/${sp.evenement}` : "/cotisations"} title="Nouveau paiement" />
      <PaymentForm
        currentSchoolYear={currentSchoolYear}
        members={members.map((m) => ({
          id: m.id,
          name: fullName(m),
          matricule: m.matricule,
          role: POSITIONS[m.position as Position] ?? m.position,
          phone: m.phone ? formatPhone(m.phone) : "",
          photoUrl: m.photoUrl,
        }))}
        initial={{
          memberId,
          feeCode,
          schoolYear: typeof sp.annee === "string" ? sp.annee : currentSchoolYear,
          months: month >= 1 && month <= 12 ? [month] : [],
          eventId: typeof sp.evenement === "string" ? sp.evenement : null,
          dues: memberId ? await getMemberDues(memberId) : [],
        }}
      />
    </div>
  );
}
