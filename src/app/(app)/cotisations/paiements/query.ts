// Filtres de l'historique des paiements, partagés par la page et l'export Excel.
import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { FEE_BY_SLUG, PAYMENT_METHODS } from "@/lib/domain";

export type PaymentFilters = { q: string; type: string; mode: string; du: string; au: string; annules: string };

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");
const isoDate = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");

export function parseFilters(sp: Record<string, string | string[] | undefined>): PaymentFilters {
  const type = one(sp.type);
  const mode = one(sp.mode);
  const annules = one(sp.annules);
  return {
    q: one(sp.q).trim().slice(0, 60),
    type: type in FEE_BY_SLUG ? type : "",
    mode: mode in PAYMENT_METHODS ? mode : "",
    du: isoDate(one(sp.du)),
    au: isoDate(one(sp.au)),
    annules: ["inclure", "seuls"].includes(annules) ? annules : "exclure",
  };
}

export function whereFor(f: PaymentFilters): Prisma.PaymentWhereInput {
  const and: Prisma.PaymentWhereInput[] = [];
  if (f.q) {
    and.push({
      OR: [
        { receiptNo: { contains: f.q.toUpperCase() } },
        { reference: { contains: f.q } },
        { member: { lastName: { contains: f.q.toUpperCase() } } },
        { member: { firstName: { contains: f.q } } },
        { member: { matricule: { contains: f.q.toUpperCase() } } },
      ],
    });
  }
  if (f.type) and.push({ allocations: { some: { due: { feeType: { code: FEE_BY_SLUG[f.type] } } } } });
  if (f.mode) and.push({ method: f.mode });
  if (f.du) and.push({ date: { gte: new Date(`${f.du}T00:00:00`) } });
  if (f.au) and.push({ date: { lte: new Date(`${f.au}T23:59:59`) } });
  if (f.annules === "exclure") and.push({ cancelled: false });
  if (f.annules === "seuls") and.push({ cancelled: true });
  return { AND: and };
}

export function findPayments(f: PaymentFilters, take?: number, skip = 0) {
  return db.payment.findMany({
    where: whereFor(f),
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take,
    skip,
    include: {
      member: { select: { firstName: true, lastName: true, matricule: true, photoUrl: true } },
      allocations: {
        include: {
          due: { select: { schoolYear: true, month: true, feeType: { select: { code: true, label: true } }, event: { select: { title: true } } } },
        },
      },
    },
  });
}
