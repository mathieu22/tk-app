"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { getAssociation, requirePermission } from "@/lib/dal";
import { formatAriary, formatDate } from "@/lib/format";
import { OPERATORS } from "@/lib/domain";
import { parseStatementCsv, RECONCILE_ACTION, reconciledIds } from "@/lib/treasury";

export type FormState = { errors?: Record<string, string>; values?: Record<string, string>; message?: string } | undefined;

const values = (fd: FormData) =>
  Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string").map(([k, v]) => [k, String(v)]));

function fieldErrors(error: z.ZodError) {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) errors[String(issue.path[0])] ??= issue.message;
  return errors;
}

const audit = (userId: string, action: string, entityId: string, details?: string) =>
  db.auditLog.create({ data: { userId, action, entity: "Operation", entityId, details } });

const refresh = () => revalidatePath("/tresorerie", "layout");

const amountField = z.coerce.number({ error: "Montant invalide." }).int("Montant entier en Ariary.").positive("Le montant doit être positif.").max(1_000_000_000);
const dateField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide.");
// Justificatif : data URL JPEG / PNG compressée côté client (ImageInput), 2 Mo maximum.
const proofField = z.union([
  z.literal(""),
  z.string().max(2_000_000, "Justificatif trop lourd.").regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/, "Justificatif invalide."),
]);

// ─── Comptes (US-6.1) ───

const accountSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Le nom est obligatoire.").max(60),
  type: z.enum(["CASH", "MOBILE_MONEY", "BANK"], { error: "Type invalide." }),
  operator: z.string(),
  openingBalance: z.coerce.number({ error: "Solde invalide." }).int("Montant entier en Ariary."),
});

export async function saveAccount(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requirePermission("treasury.manage");
  const v = values(fd);
  const parsed = accountSchema.safeParse(v);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: v };
  const d = parsed.data;
  if (d.type === "MOBILE_MONEY" && !(d.operator in OPERATORS)) return { errors: { operator: "Choisissez l'opérateur." }, values: v };
  const data = { name: d.name, type: d.type, operator: d.type === "MOBILE_MONEY" ? d.operator : null, openingBalance: d.openingBalance };
  const account = d.id
    ? await db.treasuryAccount.update({ where: { id: d.id }, data })
    : await db.treasuryAccount.create({ data });
  await db.auditLog.create({
    data: { userId: user.id, action: d.id ? "treasury.account.update" : "treasury.account.create", entity: "TreasuryAccount", entityId: account.id, details: `${account.name} — solde initial ${formatAriary(account.openingBalance)}` },
  });
  refresh();
  redirect("/tresorerie/comptes");
}

export async function toggleAccount(id: string) {
  const user = await requirePermission("treasury.manage");
  const a = await db.treasuryAccount.findUniqueOrThrow({ where: { id } });
  await db.treasuryAccount.update({ where: { id }, data: { active: !a.active } });
  await db.auditLog.create({ data: { userId: user.id, action: a.active ? "treasury.account.disable" : "treasury.account.enable", entity: "TreasuryAccount", entityId: id, details: a.name } });
  refresh();
}

// ─── Opérations : recettes, dépenses, virements (US-6.2 à 6.4) ───

const operationSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
  accountId: z.string().min(1, "Choisissez le compte."),
  transferAccountId: z.string(),
  categoryId: z.string(),
  date: dateField,
  amount: amountField,
  counterparty: z.string().trim().max(120),
  description: z.string().trim().max(500),
  proofUrl: proofField,
});

export async function createOperation(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requirePermission("treasury.manage");
  const v = values(fd);
  const parsed = operationSchema.safeParse(v);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: v };
  const d = parsed.data;
  const date = new Date(`${d.date}T00:00:00`);
  if (date > new Date()) return { errors: { date: "La date ne peut pas être dans le futur." }, values: v };

  const account = await db.treasuryAccount.findUnique({ where: { id: d.accountId } });
  if (!account?.active) return { errors: { accountId: "Compte inconnu ou désactivé." }, values: v };

  if (d.type === "TRANSFER") {
    if (!d.transferAccountId || d.transferAccountId === d.accountId) {
      return { errors: { transferAccountId: "Choisissez un compte de destination différent." }, values: v };
    }
    const target = await db.treasuryAccount.findUnique({ where: { id: d.transferAccountId } });
    if (!target?.active) return { errors: { transferAccountId: "Compte de destination inconnu." }, values: v };
  } else {
    const category = d.categoryId ? await db.operationCategory.findUnique({ where: { id: d.categoryId } }) : null;
    if (!category || category.type !== d.type) return { errors: { categoryId: "Choisissez une catégorie." }, values: v };
    if (category.system) return { errors: { categoryId: "Catégorie alimentée automatiquement par les cotisations." }, values: v };
  }

  // Circuit de validation : dépense au-delà du seuil → à valider par le Président (US-6.3),
  // sauf si l'auteur a lui-même le droit de valider.
  const association = await getAssociation();
  const needsApproval = d.type === "EXPENSE" && d.amount > association.expenseApprovalMin && !user.perms.includes("expense.approve");

  const op = await db.operation.create({
    data: {
      type: d.type,
      accountId: d.accountId,
      transferAccountId: d.type === "TRANSFER" ? d.transferAccountId : null,
      categoryId: d.type === "TRANSFER" ? null : d.categoryId,
      date,
      amount: d.amount,
      counterparty: d.counterparty || null,
      description: d.description || null,
      proofUrl: d.proofUrl || null,
      status: needsApproval ? "PENDING" : "APPROVED",
      ...(needsApproval ? {} : { approvedById: user.id, approvedAt: new Date() }),
      recordedById: user.id,
    },
  });
  await audit(user.id, "treasury.operation.create", op.id, `${d.type} ${formatAriary(d.amount)}${needsApproval ? " — à valider" : ""}`);
  refresh();
  redirect(`/tresorerie/operations/${op.id}`);
}

export async function reviewExpense(id: string, decision: "APPROVED" | "REJECTED", reason: string) {
  const user = await requirePermission("expense.approve");
  const op = await db.operation.findUniqueOrThrow({ where: { id } });
  if (op.status !== "PENDING" || op.cancelled) throw new Error("Cette dépense n'est plus en attente.");
  if (decision === "REJECTED" && !reason.trim()) throw new Error("Le motif du rejet est obligatoire.");
  await db.operation.update({
    where: { id },
    data: {
      status: decision,
      approvedById: user.id,
      approvedAt: new Date(),
      ...(decision === "REJECTED" ? { cancelReason: reason.trim().slice(0, 500) } : {}),
    },
  });
  await audit(user.id, decision === "APPROVED" ? "treasury.expense.approve" : "treasury.expense.reject", id, reason.trim() || undefined);
  refresh();
}

/** Annulation motivée (US-6.7) — jamais de suppression. Les recettes de cotisations s'annulent via le paiement. */
export async function cancelOperation(id: string, reason: string) {
  const user = await requirePermission("treasury.manage");
  if (!reason.trim()) throw new Error("Le motif est obligatoire.");
  const op = await db.operation.findUniqueOrThrow({ where: { id } });
  if (op.cancelled) throw new Error("Opération déjà annulée.");
  if (op.paymentId) throw new Error("Recette de cotisation : annulez le paiement depuis le module Cotisations.");
  await db.operation.update({ where: { id }, data: { cancelled: true, cancelReason: reason.trim().slice(0, 500), cancelledAt: new Date() } });
  await audit(user.id, "treasury.operation.cancel", id, reason.trim());
  refresh();
}

// ─── Catégories (US-6.3) ───

const categorySchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Le nom est obligatoire.").max(60),
  type: z.enum(["INCOME", "EXPENSE"]),
});

export async function saveCategory(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requirePermission("treasury.manage");
  const v = values(fd);
  const parsed = categorySchema.safeParse(v);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: v };
  const { id, name, type } = parsed.data;
  const clash = await db.operationCategory.findUnique({ where: { name_type: { name, type } } });
  if (clash && clash.id !== id) return { errors: { name: "Cette catégorie existe déjà." }, values: v };
  if (id) {
    const current = await db.operationCategory.findUniqueOrThrow({ where: { id } });
    if (current.system) return { message: "Catégorie système : non modifiable." };
    await db.operationCategory.update({ where: { id }, data: { name } });
  } else {
    await db.operationCategory.create({ data: { name, type } });
  }
  await db.auditLog.create({ data: { userId: user.id, action: "treasury.category.save", entity: "OperationCategory", entityId: id, details: `${type} ${name}` } });
  refresh();
  return { message: id ? "Catégorie renommée." : "Catégorie ajoutée." };
}

export async function deleteCategory(id: string) {
  const user = await requirePermission("treasury.manage");
  const c = await db.operationCategory.findUniqueOrThrow({ where: { id }, include: { _count: { select: { operations: true } } } });
  if (c.system) throw new Error("Catégorie système : non supprimable.");
  if (c._count.operations > 0) throw new Error("Catégorie utilisée par des opérations : renommez-la plutôt.");
  await db.operationCategory.delete({ where: { id } });
  await db.auditLog.create({ data: { userId: user.id, action: "treasury.category.delete", entity: "OperationCategory", entityId: id, details: c.name } });
  refresh();
}

// ─── Budget (US-6.5) ───

export async function saveBudget(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requirePermission("treasury.manage");
  const schoolYear = String(fd.get("schoolYear") ?? "");
  if (!/^\d{4}-\d{4}$/.test(schoolYear)) return { message: "Année scolaire invalide." };
  const categories = await db.operationCategory.findMany();
  let count = 0;
  for (const c of categories) {
    const raw = fd.get(`budget_${c.id}`);
    if (raw === null) continue;
    const amount = Number(String(raw).replace(/\s/g, "") || 0);
    if (!Number.isInteger(amount) || amount < 0) return { message: `Montant invalide pour « ${c.name} ».` };
    if (amount === 0) await db.budget.deleteMany({ where: { schoolYear, categoryId: c.id } });
    else await db.budget.upsert({
      where: { schoolYear_categoryId: { schoolYear, categoryId: c.id } },
      create: { schoolYear, categoryId: c.id, amount },
      update: { amount },
    });
    count++;
  }
  await db.auditLog.create({ data: { userId: user.id, action: "treasury.budget.save", entity: "Budget", details: `${schoolYear} (${count} lignes)` } });
  refresh();
  return { message: "Budget enregistré." };
}

// ─── Rapprochement bancaire / Mobile Money (C) ───

export type ReconcileRow = {
  line: number; date: string; label: string; amount: number;
  match: { id: string; date: string; amount: number; type: string; description: string } | null;
  already: boolean;
};
export type ReconcileState = { rows?: ReconcileRow[]; errors?: string[]; accountId?: string; message?: string } | undefined;

/** Étape 1 : lit le relevé et propose un appariement (même montant, même sens, ± 3 jours). */
export async function previewReconcile(_: ReconcileState, fd: FormData): Promise<ReconcileState> {
  await requirePermission("treasury.manage");
  const accountId = String(fd.get("accountId") ?? "");
  const file = fd.get("file");
  if (!accountId) return { errors: ["Choisissez le compte."] };
  if (!(file instanceof File) || file.size === 0) return { errors: ["Choisissez un fichier CSV."], accountId };
  if (file.size > 2_000_000) return { errors: ["Fichier trop volumineux (2 Mo maximum)."], accountId };
  const { rows, errors } = parseStatementCsv(await file.text());
  if (!rows.length) return { errors: errors.length ? errors : ["Aucune ligne exploitable."], accountId };

  const min = new Date(Math.min(...rows.map((r) => r.date.getTime())) - 3 * 86400e3);
  const max = new Date(Math.max(...rows.map((r) => r.date.getTime())) + 4 * 86400e3);
  const ops = await db.operation.findMany({
    where: {
      cancelled: false, status: "APPROVED", date: { gte: min, lt: max },
      OR: [{ accountId }, { transferAccountId: accountId }],
    },
    orderBy: { date: "asc" },
  });
  const done = await reconciledIds(ops.map((o) => o.id));
  const used = new Set<string>();
  const out: ReconcileRow[] = rows.map((r) => {
    const credit = r.amount > 0;
    const candidate = ops.find((o) => {
      if (used.has(o.id) || o.amount !== Math.abs(r.amount)) return false;
      if (Math.abs(o.date.getTime() - r.date.getTime()) > 3 * 86400e3) return false;
      const isCredit = o.type === "INCOME" || (o.type === "TRANSFER" && o.transferAccountId === accountId);
      return isCredit === credit;
    });
    if (candidate) used.add(candidate.id);
    return {
      line: r.line, date: formatDate(r.date), label: r.label, amount: r.amount,
      match: candidate ? { id: candidate.id, date: formatDate(candidate.date), amount: candidate.amount, type: candidate.type, description: candidate.description ?? candidate.counterparty ?? "" } : null,
      already: candidate ? done.has(candidate.id) : false,
    };
  });
  return { rows: out, errors, accountId };
}

/** Étape 2 : marque les opérations appariées comme rapprochées (journal d'audit). */
export async function confirmReconcile(_: ReconcileState, fd: FormData): Promise<ReconcileState> {
  const user = await requirePermission("treasury.manage");
  const ids = fd.getAll("opId").map(String).filter(Boolean);
  const done = await reconciledIds(ids);
  const fresh = ids.filter((id) => !done.has(id));
  const existing = await db.operation.findMany({ where: { id: { in: fresh } }, select: { id: true } });
  if (existing.length) {
    await db.auditLog.createMany({
      data: existing.map((o) => ({ userId: user.id, action: RECONCILE_ACTION, entity: "Operation", entityId: o.id, details: "Rapproché avec le relevé" })),
    });
  }
  refresh();
  return { message: `${existing.length} opération${existing.length > 1 ? "s" : ""} rapprochée${existing.length > 1 ? "s" : ""}.` };
}
