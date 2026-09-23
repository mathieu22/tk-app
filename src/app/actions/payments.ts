"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { getAssociation, requirePermission } from "@/lib/dal";
import { OPERATORS, PAYMENT_METHODS, type FeeCode } from "@/lib/domain";
import { recordPayment } from "@/lib/fees";

export type MemberDue = {
  feeCode: FeeCode;
  schoolYear: string;
  month: number;
  amountDue: number;
  amountPaid: number;
  status: string;
};

function previousSchoolYear(sy: string) {
  const start = Number(sy.slice(0, 4));
  return `${start - 1}-${start}`;
}

/** Échéances d'un membre (année en cours + précédente) pour le formulaire de paiement. */
export async function getMemberDues(memberId: string): Promise<MemberDue[]> {
  await requirePermission("payment.create");
  if (typeof memberId !== "string" || !memberId) return [];
  const { currentSchoolYear } = await getAssociation();
  const dues = await db.due.findMany({
    where: {
      memberId,
      schoolYear: { in: [currentSchoolYear, previousSchoolYear(currentSchoolYear)] },
      feeType: { code: { in: ["DROIT", "PASSPORT", "ECOLAGE"] } },
    },
    select: { schoolYear: true, month: true, amountDue: true, amountPaid: true, status: true, feeType: { select: { code: true } } },
  });
  return dues.map(({ feeType, ...d }) => ({ ...d, feeCode: feeType.code as FeeCode }));
}

export type PaymentFormState = { error?: string; fieldErrors?: Record<string, string> } | undefined;

const methods = Object.keys(PAYMENT_METHODS) as [keyof typeof PAYMENT_METHODS, ...(keyof typeof PAYMENT_METHODS)[]];
const operators = Object.keys(OPERATORS) as [keyof typeof OPERATORS, ...(keyof typeof OPERATORS)[]];
const optionalText = (max: number) =>
  z.string().trim().max(max).optional().transform((v) => (v ? v : undefined));

const schema = z
  .object({
    memberId: z.string().min(1, "Choisissez un membre."),
    feeCode: z.enum(["DROIT", "PASSPORT", "ECOLAGE"], { message: "Choisissez un type de frais." }),
    schoolYear: z.string().regex(/^\d{4}-\d{4}$/, "Année scolaire invalide."),
    months: z
      .string()
      .optional()
      .transform((v) => (v ? v.split(",").map(Number) : []))
      .pipe(z.array(z.number().int().min(1).max(12))),
    amount: z
      .string()
      .transform((v) => Number(v.replace(/\D/g, "")))
      .pipe(z.number().int().positive("Le montant doit être supérieur à 0.").max(100_000_000, "Montant trop élevé.")),
    method: z.enum(methods, { message: "Choisissez un mode de paiement." }),
    operator: z.enum(operators).optional().or(z.literal("").transform(() => undefined)),
    reference: optionalText(100),
    note: optionalText(500),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide."),
  })
  .superRefine((v, ctx) => {
    if (v.method === "MOBILE_MONEY" && !v.operator)
      ctx.addIssue({ code: "custom", path: ["operator"], message: "Choisissez l'opérateur Mobile Money." });
    if (v.method !== "CASH" && !v.reference)
      ctx.addIssue({ code: "custom", path: ["reference"], message: "La référence est obligatoire pour ce mode de paiement." });
    if (v.feeCode === "ECOLAGE" && v.months.length === 0)
      ctx.addIssue({ code: "custom", path: ["months"], message: "Sélectionnez au moins un mois." });
  });

export async function createPayment(_: PaymentFormState, formData: FormData): Promise<PaymentFormState> {
  const user = await requirePermission("payment.create");
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { error: "Vérifiez les champs signalés.", fieldErrors };
  }
  const v = parsed.data;

  // Midi local : évite qu'un décalage horaire fasse changer de jour.
  const date = new Date(`${v.date}T12:00:00`);
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  if (Number.isNaN(date.getTime()) || date > endOfToday)
    return { error: "Vérifiez les champs signalés.", fieldErrors: { date: "La date ne peut pas être dans le futur." } };

  const member = await db.member.findFirst({ where: { id: v.memberId, archived: false }, select: { id: true } });
  if (!member) return { error: "Membre introuvable." };

  const months = v.feeCode === "ECOLAGE" ? [...new Set(v.months)] : [];
  const dues = await db.due.findMany({
    where: { memberId: v.memberId, feeType: { code: v.feeCode }, schoolYear: v.schoolYear, month: { in: months.length ? months : [0] } },
    select: { month: true, status: true },
  });
  if (dues.length !== (months.length || 1)) return { error: "Aucune échéance ne correspond à cette période." };
  if (dues.some((d) => d.status === "PAID"))
    return { error: v.feeCode === "ECOLAGE" ? "Un des mois sélectionnés est déjà payé." : "Cette cotisation est déjà payée." };

  let paymentId: string;
  try {
    const payment = await recordPayment({
      memberId: v.memberId,
      feeCode: v.feeCode,
      schoolYear: v.schoolYear,
      months,
      amount: v.amount,
      method: v.method,
      operator: v.method === "MOBILE_MONEY" ? v.operator : null,
      reference: v.reference ?? null,
      note: v.note ?? null,
      date,
      recordedById: user.id,
    });
    paymentId = payment.id;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Le paiement n'a pas pu être enregistré." };
  }

  revalidatePath("/cotisations", "layout");
  revalidatePath(`/membres/${v.memberId}`);
  redirect(`/cotisations/paiement/${paymentId}`);
}
