"use server";
// Actions du module Grades (EPIC 4).
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { gradeSummaries } from "@/app/(app)/grades/data";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/dal";
import { fullName } from "@/lib/domain";
import { drawPoomsae, gradeShortLabel, POOMSAE_UP_TO_KORYO } from "@/lib/grades";
import { notifyMember } from "@/lib/notify";

export type FormState = { error?: string; errors?: Record<string, string>; ok?: string } | undefined;

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const optInt = z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().min(0).max(999).nullable());
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide.");
const hexOrName = z.string().trim().min(1).max(20);

function zodErrors(err: z.ZodError) {
  const errors: Record<string, string> = {};
  for (const i of err.issues) errors[String(i.path[0])] ??= i.message;
  return { errors, error: "Vérifiez les champs signalés." };
}

async function audit(userId: string, action: string, entity: string, entityId: string, details?: string) {
  await db.auditLog.create({ data: { userId, action, entity, entityId, details } });
}

// ─── Référentiel (US-4.1) ───

const gridSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Nom obligatoire.").max(60),
  ageMin: optInt,
  ageMax: optInt,
});

export async function saveGrid(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requirePermission("grade.manage");
  const p = gridSchema.safeParse({ id: str(fd, "id") || undefined, name: str(fd, "name"), ageMin: str(fd, "ageMin"), ageMax: str(fd, "ageMax") });
  if (!p.success) return zodErrors(p.error);
  const { id, ...data } = p.data;
  const clash = await db.gradeGrid.findFirst({ where: { name: data.name, ...(id ? { NOT: { id } } : {}) } });
  if (clash) return { errors: { name: "Une grille porte déjà ce nom." } };
  const grid = id ? await db.gradeGrid.update({ where: { id }, data }) : await db.gradeGrid.create({ data });
  await audit(user.id, id ? "grid.update" : "grid.create", "GradeGrid", grid.id, grid.name);
  revalidatePath("/grades/referentiel");
  return { ok: "Grille enregistrée." };
}

const gradeSchema = z.object({
  id: z.string().optional(),
  gridId: z.string().min(1),
  kind: z.enum(["KEUP", "POOM", "DAN"]),
  number: z.coerce.number().int().min(1, "Numéro invalide.").max(20),
  beltLabel: z.string().trim().min(1, "Libellé obligatoire.").max(80),
  mainColor: hexOrName,
  stripeColor: z.string().trim().max(20).nullable(),
  stripeCount: z.coerce.number().int().min(0).max(2),
  poomsae: z.string().trim().max(200).nullable(),
  drawRule: z.string().trim().max(200).nullable(),
  minMonths: z.coerce.number().int().min(0).max(120),
  minAge: optInt,
  minAttendance: z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().min(0).max(100).nullable()),
});

export async function saveGrade(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requirePermission("grade.manage");
  const raw = Object.fromEntries([...fd.entries()].map(([k, v]) => [k, String(v).trim()]));
  const p = gradeSchema.safeParse({
    ...raw,
    id: raw.id || undefined,
    stripeColor: raw.stripeColor || null,
    poomsae: raw.poomsae || null,
    drawRule: raw.drawRule || null,
  });
  if (!p.success) return zodErrors(p.error);
  const { id, ...data } = p.data;
  const clash = await db.grade.findFirst({ where: { gridId: data.gridId, kind: data.kind, number: data.number, ...(id ? { NOT: { id } } : {}) } });
  if (clash) return { errors: { number: "Ce grade existe déjà dans la grille." } };
  let grade;
  if (id) grade = await db.grade.update({ where: { id }, data });
  else {
    const last = await db.grade.findFirst({ where: { gridId: data.gridId }, orderBy: { order: "desc" } });
    grade = await db.grade.create({ data: { ...data, order: (last?.order ?? -1) + 1 } });
  }
  await audit(user.id, id ? "grade.update" : "grade.create", "Grade", grade.id, grade.beltLabel);
  revalidatePath("/grades/referentiel");
  return { ok: "Grade enregistré." };
}

/** Réordonne un grade dans sa grille (échange avec le voisin). */
export async function moveGrade(id: string, direction: "up" | "down") {
  await requirePermission("grade.manage");
  const g = await db.grade.findUniqueOrThrow({ where: { id } });
  const neighbour = await db.grade.findFirst({
    where: { gridId: g.gridId, order: direction === "up" ? { lt: g.order } : { gt: g.order } },
    orderBy: { order: direction === "up" ? "desc" : "asc" },
  });
  if (!neighbour) return;
  await db.$transaction([
    db.grade.update({ where: { id: g.id }, data: { order: neighbour.order } }),
    db.grade.update({ where: { id: neighbour.id }, data: { order: g.order } }),
  ]);
  revalidatePath("/grades/referentiel");
}

export async function toggleGradeActive(id: string) {
  const user = await requirePermission("grade.manage");
  const g = await db.grade.findUniqueOrThrow({ where: { id } });
  await db.grade.update({ where: { id }, data: { active: !g.active } });
  await audit(user.id, g.active ? "grade.disable" : "grade.enable", "Grade", id, g.beltLabel);
  revalidatePath("/grades/referentiel");
}

/** Correspondance Enfant → Adulte ; adultGradeId vide = supprimer. */
export async function saveMapping(childGradeId: string, adultGradeId: string) {
  const user = await requirePermission("grade.manage");
  if (!adultGradeId) await db.gradeMapping.deleteMany({ where: { childGradeId } });
  else {
    const [child, adult] = await Promise.all([
      db.grade.findUniqueOrThrow({ where: { id: childGradeId }, include: { grid: true } }),
      db.grade.findUniqueOrThrow({ where: { id: adultGradeId }, include: { grid: true } }),
    ]);
    if (child.grid.name !== "Enfant" || adult.grid.name !== "Adulte") throw new Error("Correspondance invalide.");
    await db.gradeMapping.upsert({ where: { childGradeId }, create: { childGradeId, adultGradeId }, update: { adultGradeId } });
  }
  await audit(user.id, "grade.mapping", "Grade", childGradeId, adultGradeId || "—");
  revalidatePath("/grades/referentiel");
}

// ─── Passage de grade (US-4.3) ───

const passageSchema = z.object({
  memberId: z.string().min(1, "Choisissez un athlète."),
  gradeId: z.string().min(1, "Choisissez un grade."),
  date: dateStr,
  jury: z.string().trim().max(200),
  mention: z.string().trim().max(60),
  observation: z.string().trim().max(1000),
  certificate: z.string().trim().max(60),
  proofUrl: z.string().max(600_000, "Image trop lourde.").refine((v) => v === "" || v.startsWith("data:image/"), "Image invalide."),
  confirmLower: z.string().optional(),
});

export async function recordPassage(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requirePermission("grade.manage");
  const raw = Object.fromEntries([...fd.entries()].map(([k, v]) => [k, String(v)]));
  const p = passageSchema.safeParse(raw);
  if (!p.success) return zodErrors(p.error);
  const d = p.data;
  const [member, grade, last] = await Promise.all([
    db.member.findUnique({ where: { id: d.memberId } }),
    db.grade.findUnique({ where: { id: d.gradeId }, include: { grid: true } }),
    db.gradePassage.findFirst({ where: { memberId: d.memberId }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], include: { grade: { include: { grid: true } } } }),
  ]);
  if (!member || member.archived) return { errors: { memberId: "Athlète introuvable." } };
  if (!grade) return { errors: { gradeId: "Grade introuvable." } };
  if (grade.kind !== "KEUP" && !d.certificate) return { errors: { certificate: "N° de certificat Kukkiwon obligatoire pour un poom / dan." } };

  // Avertissement si grade inférieur au grade actuel (correction d'erreur possible, US-4.3)
  const rank = (g: { kind: string; order: number; number: number }) => (g.kind === "KEUP" ? g.order : 100 + g.number);
  const lower = last && (last.grade.gridId === grade.gridId || grade.kind !== "KEUP" || last.grade.kind !== "KEUP") && rank(grade) < rank(last.grade);
  if (lower && d.confirmLower !== "1") {
    return { error: `Ce grade est inférieur au grade actuel (${last!.grade.beltLabel}). Cochez la confirmation pour corriger une erreur.`, errors: { confirmLower: "À confirmer" } };
  }

  const passage = await db.gradePassage.create({
    data: {
      memberId: member.id, gradeId: grade.id, date: new Date(`${d.date}T12:00:00`),
      jury: d.jury || null, mention: d.mention || null, observation: d.observation || null,
      certificate: d.certificate || null, proofUrl: d.proofUrl || null, recordedById: user.id,
    },
  });
  await audit(user.id, "grade.passage", "Member", member.id, `${grade.beltLabel}${lower ? " (correction)" : ""}`);
  await notifyMember(member.id, "GRADE", "Nouveau grade", `${fullName(member)} : ${grade.beltLabel} (${gradeShortLabel(grade)}).`, `/grades/athletes/${member.id}`);
  revalidatePath(`/grades/athletes/${member.id}`);
  revalidatePath("/grades");
  redirect(`/grades/athletes/${member.id}?ok=${passage.id}`);
}

export async function deletePassage(id: string) {
  const user = await requirePermission("grade.manage");
  const p = await db.gradePassage.findUniqueOrThrow({ where: { id }, include: { grade: true } });
  await db.gradePassage.delete({ where: { id } });
  await audit(user.id, "grade.passage.delete", "Member", p.memberId, `${p.grade.beltLabel} du ${p.date.toISOString().slice(0, 10)}`);
  revalidatePath(`/grades/athletes/${p.memberId}`);
}

// ─── Sessions d'examen (US-4.4) ───

const examSchema = z.object({
  date: dateStr,
  startTime: z.union([z.literal(""), z.string().regex(/^\d{2}:\d{2}$/)]),
  location: z.string().trim().max(120),
  jury: z.string().trim().max(300),
  external: z.enum(["0", "1"]),
});

export async function createExam(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requirePermission("grade.manage");
  const p = examSchema.safeParse({
    date: str(fd, "date"), startTime: str(fd, "startTime"), location: str(fd, "location"), jury: str(fd, "jury"), external: str(fd, "external") || "0",
  });
  if (!p.success) return zodErrors(p.error);
  const d = p.data;
  const date = new Date(`${d.date}T00:00:00`);
  const external = d.external === "1";
  const type = await db.eventType.findFirst({ where: { label: "Passage de grade" } });

  const exam = await db.$transaction(async (tx) => {
    // L'examen crée un événement « Passage de grade » pour les convocations et la présence (EPIC 1)
    const event = type && !external
      ? await tx.event.create({
          data: {
            title: `Passage de grade — ${d.date.split("-").reverse().join("/")}`,
            typeId: type.id, startDate: date, endDate: date, location: d.location || null,
            description: d.jury ? `Jury : ${d.jury}` : null, audience: "SELECTION", participationMode: "SUMMONS",
            createdById: user.id,
            days: { create: { date, startTime: d.startTime || null } },
          },
        })
      : null;
    return tx.gradeExam.create({ data: { date, location: d.location || null, jury: d.jury || null, external, eventId: event?.id } });
  });
  await audit(user.id, "exam.create", "GradeExam", exam.id);
  revalidatePath("/grades/examens");
  redirect(`/grades/examens/${exam.id}`);
}

/** Ajoute des candidats avec grade visé proposé automatiquement ; convoqués à l'événement lié. */
export async function addCandidates(examId: string, memberIds: string[]) {
  await requirePermission("grade.manage");
  const exam = await db.gradeExam.findUniqueOrThrow({ where: { id: examId } });
  if (exam.status === "CLOSED") throw new Error("Examen clôturé.");
  const members = await db.member.findMany({ where: { id: { in: memberIds }, archived: false } });
  const summaries = await gradeSummaries(members);
  for (const m of members) {
    const s = summaries.get(m.id);
    let targetId = s?.next?.id;
    if (!targetId) {
      // Poom / dan ou fin de grille : premier grade non keup à défaut
      const fallback = await db.grade.findFirst({ where: { kind: { not: "KEUP" }, active: true }, orderBy: { number: "asc" } });
      targetId = fallback?.id;
    }
    if (!targetId) continue;
    await db.examCandidate.upsert({
      where: { examId_memberId: { examId, memberId: m.id } },
      create: { examId, memberId: m.id, targetGradeId: targetId },
      update: {},
    });
    if (exam.eventId) {
      await db.eventRegistration.upsert({
        where: { eventId_memberId: { eventId: exam.eventId, memberId: m.id } },
        create: { eventId: exam.eventId, memberId: m.id, response: "YES" },
        update: {},
      });
    }
  }
  revalidatePath(`/grades/examens/${examId}`);
}

export async function removeCandidate(candidateId: string) {
  await requirePermission("grade.manage");
  const c = await db.examCandidate.delete({ where: { id: candidateId }, include: { exam: true } });
  if (c.exam.eventId) await db.eventRegistration.deleteMany({ where: { eventId: c.exam.eventId, memberId: c.memberId } });
  revalidatePath(`/grades/examens/${c.examId}`);
}

export async function setCandidateTarget(candidateId: string, targetGradeId: string) {
  await requirePermission("grade.manage");
  const c = await db.examCandidate.update({ where: { id: candidateId }, data: { targetGradeId, drawnPoomsae: null } });
  revalidatePath(`/grades/examens/${c.examId}`);
}

/**
 * Tirage au sort (US-4.4) : 2e keup → 2 poomsae au choix, 1er keup → 1 poomsae parmi tous
 * ceux jusqu'au Koryo ; enregistré au procès-verbal. Nombre déduit de la règle de tirage du grade.
 */
export async function drawCandidatePoomsae(candidateId: string) {
  await requirePermission("grade.manage");
  const c = await db.examCandidate.findUniqueOrThrow({ where: { id: candidateId }, include: { targetGrade: true, exam: true } });
  if (c.exam.status === "CLOSED") throw new Error("Examen clôturé.");
  const rule = c.targetGrade.drawRule ?? "";
  if (!rule) throw new Error("Aucun tirage prévu pour ce grade.");
  const count = Number(rule.match(/(\d+)\s*poomsae/i)?.[1] ?? 1);
  const drawn = drawPoomsae(count, POOMSAE_UP_TO_KORYO.filter((p) => p !== "Taegeuk Pal Jang"));
  await db.examCandidate.update({ where: { id: c.id }, data: { drawnPoomsae: drawn.join(", ") } });
  revalidatePath(`/grades/examens/${c.examId}`);
  return drawn;
}

const RESULTS = ["PENDING", "PASSED", "FAILED"] as const;

/** Saisie des résultats en lot : notes par épreuve, Admis / Ajourné, observation, certificat (externe). */
export async function saveExamResults(examId: string, _: FormState, fd: FormData): Promise<FormState> {
  await requirePermission("grade.manage");
  const exam = await db.gradeExam.findUniqueOrThrow({ where: { id: examId }, include: { candidates: true } });
  if (exam.status === "CLOSED") return { error: "Examen clôturé." };
  for (const c of exam.candidates) {
    const scores: Record<string, string> = {};
    for (const t of ["poomsae", "kibon", "kyorugi", "kyukpa", "theorie"]) {
      const v = str(fd, `${c.id}.${t}`).slice(0, 20);
      if (v) scores[t] = v;
    }
    const result = str(fd, `${c.id}.result`);
    await db.examCandidate.update({
      where: { id: c.id },
      data: {
        scores: JSON.stringify(scores),
        result: (RESULTS as readonly string[]).includes(result) ? result : "PENDING",
        note: str(fd, `${c.id}.note`).slice(0, 300) || null,
      },
    });
  }
  revalidatePath(`/grades/examens/${examId}`);
  return { ok: "Résultats enregistrés." };
}

/**
 * Clôture : crée les passages de grade des admis (mise à jour automatique des grades),
 * notifie les familles. Pour un examen externe (poom / dan), le n° de certificat est pris dans la note.
 */
export async function closeExam(examId: string) {
  const user = await requirePermission("grade.manage");
  const exam = await db.gradeExam.findUniqueOrThrow({
    where: { id: examId },
    include: { candidates: { include: { member: true, targetGrade: true } } },
  });
  if (exam.status === "CLOSED") return;
  if (exam.candidates.some((c) => c.result === "PENDING")) throw new Error("Tous les candidats doivent être Admis ou Ajournés.");
  for (const c of exam.candidates.filter((c) => c.result === "PASSED")) {
    await db.gradePassage.create({
      data: {
        memberId: c.memberId, gradeId: c.targetGradeId, date: exam.date, jury: exam.jury, examId: exam.id,
        observation: c.drawnPoomsae ? `Tirage : ${c.drawnPoomsae}` : null,
        certificate: exam.external ? c.note : null, recordedById: user.id,
      },
    });
    await notifyMember(c.memberId, "GRADE", "Examen réussi", `${fullName(c.member)} obtient ${c.targetGrade.beltLabel}.`, `/grades/athletes/${c.memberId}`);
  }
  await db.gradeExam.update({ where: { id: examId }, data: { status: "CLOSED" } });
  await audit(user.id, "exam.close", "GradeExam", examId, `${exam.candidates.filter((c) => c.result === "PASSED").length} admis`);
  revalidatePath(`/grades/examens/${examId}`);
  revalidatePath("/grades");
}
