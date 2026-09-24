"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { getAssociation, requirePermission } from "@/lib/dal";
import { fullName, OPERATORS, PAYMENT_METHODS, type FeeCode } from "@/lib/domain";
import { cancelPayment, recordPayment } from "@/lib/fees";
import { formatAriary } from "@/lib/format";
import { sendMessage } from "@/lib/messaging";
import { notifyMember } from "@/lib/notify";
import { overdueFor } from "@/app/(app)/cotisations/overdue";

export type MemberDue = {
  feeCode: FeeCode;
  schoolYear: string;
  month: number;
  amountDue: number;
  amountPaid: number;
  status: string;
  eventId: string | null;
  eventTitle: string | null;
};

function previousSchoolYear(sy: string) {
  const start = Number(sy.slice(0, 4));
  return `${start - 1}-${start}`;
}

/** Échéances d'un membre (année en cours + précédente, et frais d'événements) pour le formulaire. */
export async function getMemberDues(memberId: string): Promise<MemberDue[]> {
  await requirePermission("payment.create");
  if (typeof memberId !== "string" || !memberId) return [];
  const { currentSchoolYear } = await getAssociation();
  const dues = await db.due.findMany({
    where: {
      memberId,
      OR: [
        { schoolYear: { in: [currentSchoolYear, previousSchoolYear(currentSchoolYear)] }, feeType: { code: { in: ["DROIT", "PASSPORT", "ECOLAGE"] } } },
        { feeType: { code: "EVENT" }, event: { cancelled: false } },
      ],
    },
    select: {
      schoolYear: true, month: true, amountDue: true, amountPaid: true, status: true, eventId: true,
      feeType: { select: { code: true } }, event: { select: { title: true } },
    },
  });
  return dues.map(({ feeType, event, ...d }) => ({ ...d, feeCode: feeType.code as FeeCode, eventTitle: event?.title ?? null }));
}

export type PaymentFormState = { error?: string; fieldErrors?: Record<string, string> } | undefined;

const methods = Object.keys(PAYMENT_METHODS) as [keyof typeof PAYMENT_METHODS, ...(keyof typeof PAYMENT_METHODS)[]];
const operators = Object.keys(OPERATORS) as [keyof typeof OPERATORS, ...(keyof typeof OPERATORS)[]];
const optionalText = (max: number) =>
  z.string().trim().max(max).optional().transform((v) => (v ? v : undefined));

const schema = z
  .object({
    memberId: z.string().min(1, "Choisissez un membre."),
    feeCode: z.enum(["DROIT", "PASSPORT", "ECOLAGE", "EVENT"], { message: "Choisissez un type de frais." }),
    schoolYear: z.string().regex(/^\d{4}-\d{4}$/, "Année scolaire invalide."),
    eventId: optionalText(40),
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
    credit: z.string().optional(), // « 1 » : surplus enregistré comme avoir
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide."),
  })
  .superRefine((v, ctx) => {
    if (v.method === "MOBILE_MONEY" && !v.operator)
      ctx.addIssue({ code: "custom", path: ["operator"], message: "Choisissez l'opérateur Mobile Money." });
    if (v.method !== "CASH" && !v.reference)
      ctx.addIssue({ code: "custom", path: ["reference"], message: "La référence est obligatoire pour ce mode de paiement." });
    if (v.feeCode === "ECOLAGE" && v.months.length === 0)
      ctx.addIssue({ code: "custom", path: ["months"], message: "Sélectionnez au moins un mois." });
    if (v.feeCode === "EVENT" && !v.eventId)
      ctx.addIssue({ code: "custom", path: ["eventId"], message: "Choisissez un événement." });
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

  const isEvent = v.feeCode === "EVENT";
  const months = v.feeCode === "ECOLAGE" ? [...new Set(v.months)] : [];
  const dues = await db.due.findMany({
    where: {
      memberId: v.memberId, feeType: { code: v.feeCode }, month: { in: months.length ? months : [0] },
      eventKey: isEvent ? v.eventId! : "",
      ...(isEvent ? {} : { schoolYear: v.schoolYear }),
    },
    select: { month: true, status: true, amountDue: true, amountPaid: true },
  });
  if (dues.length !== (months.length || 1)) return { error: "Aucune échéance ne correspond à cette période." };
  if (dues.some((d) => d.status === "PAID"))
    return {
      error: v.feeCode === "ECOLAGE" ? "Un des mois sélectionnés est déjà payé." : isEvent ? "Ces frais d'événement sont déjà payés." : "Cette cotisation est déjà payée.",
    };

  // Avoir (C) : le surplus reste affecté à la dernière échéance ; on le trace dans la note du reçu.
  const outstanding = dues.reduce((n, d) => n + Math.max(0, d.amountDue - d.amountPaid), 0);
  const surplus = v.amount - outstanding;
  const note = surplus > 0 && v.credit === "1"
    ? [`Avoir de ${formatAriary(surplus)} à déduire d'une prochaine échéance.`, v.note].filter(Boolean).join(" ")
    : v.note;

  let paymentId: string;
  let feeLabel = "";
  try {
    const payment = await recordPayment({
      memberId: v.memberId,
      feeCode: v.feeCode,
      schoolYear: v.schoolYear,
      months,
      eventId: isEvent ? v.eventId : null,
      amount: v.amount,
      method: v.method,
      operator: v.method === "MOBILE_MONEY" ? v.operator : null,
      reference: v.reference ?? null,
      note: note ?? null,
      date,
      recordedById: user.id,
    });
    paymentId = payment.id;
    feeLabel = (await db.feeType.findUnique({ where: { code: v.feeCode }, select: { label: true } }))?.label ?? "";
    await notifyMember(
      v.memberId, "PAYMENT", "Paiement enregistré",
      `${feeLabel} : ${formatAriary(v.amount)} — reçu ${payment.receiptNo}.`,
      `/cotisations/paiement/${payment.id}`,
    );
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Le paiement n'a pas pu être enregistré." };
  }

  revalidatePath("/cotisations", "layout");
  revalidatePath(`/membres/${v.memberId}`);
  redirect(`/cotisations/paiement/${paymentId}`);
}

// ─── Annulation (US-3.4) ───

export type CancelState = { error?: string } | undefined;

export async function cancelPaymentAction(_: CancelState, formData: FormData): Promise<CancelState> {
  const user = await requirePermission("payment.cancel");
  const paymentId = String(formData.get("paymentId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 300);
  if (!reason) return { error: "Le motif est obligatoire." };
  const payment = await db.payment.findUnique({ where: { id: paymentId }, select: { memberId: true } });
  if (!payment) return { error: "Paiement introuvable." };
  try {
    await cancelPayment(paymentId, reason, user.id);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Annulation impossible." };
  }
  revalidatePath("/cotisations", "layout");
  revalidatePath(`/membres/${payment.memberId}`);
  revalidatePath("/tresorerie", "layout");
  redirect(`/cotisations/paiement/${paymentId}`);
}

// ─── Relances (US-3.6) ───

export type ReminderState = { sent?: number; error?: string } | undefined;

/** Envoie les relances via la passerelle SMS (file OutboundMessage) + notification in-app. */
export async function sendReminders(_: ReminderState, formData: FormData): Promise<ReminderState> {
  await requirePermission("payment.create");
  const ids = formData.getAll("memberId").map(String).filter(Boolean).slice(0, 500);
  if (ids.length === 0) return { error: "Sélectionnez au moins un membre." };
  const association = await getAssociation();
  const rows = await overdueFor(association.currentSchoolYear, ids);
  let sent = 0;
  for (const r of rows) {
    if (r.recipientPhone) {
      await sendMessage("SMS", r.recipientPhone, r.message);
      sent++;
    }
    await notifyMember(r.memberId, "OVERDUE", "Cotisation en retard", `${fullName(r.member)} : ${formatAriary(r.total)} à régler (${r.details}).`, "/mon-espace");
  }
  revalidatePath("/cotisations/relances");
  return { sent };
}
