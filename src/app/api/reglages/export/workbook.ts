// Export complet de la base (US-8.5) : un classeur Excel multi-feuilles.
import "server-only";
import { db } from "@/lib/db";
import { MEMBER_STATUSES, POSITIONS, SEXES } from "@/lib/domain";
import type { Sheet } from "@/lib/export";
import { formatDate, formatPhone } from "@/lib/format";

const d = (v: Date | null | undefined) => (v ? formatDate(v) : "");
const ph = (v: string | null | undefined) => (v ? formatPhone(v) : "");
const col = (header: string, key: string, width?: number) => ({ header, key, width });

export async function buildFullExport(): Promise<Sheet[]> {
  const [members, parents, sessions, attendances, events, dues, payments, operations, passages, results] = await Promise.all([
    db.member.findMany({ orderBy: { matricule: "asc" }, include: { group: true, parents: { include: { parent: true }, orderBy: { rank: "asc" } } } }),
    db.parent.findMany({ orderBy: { lastName: "asc" }, include: { children: { include: { member: true } } } }),
    db.session.findMany({ orderBy: { date: "desc" }, include: { group: true } }),
    db.attendance.findMany({ include: { member: true, session: true, eventDay: { include: { event: true } } } }),
    db.event.findMany({ orderBy: { startDate: "desc" }, include: { type: true, _count: { select: { registrations: true } } } }),
    db.due.findMany({ include: { member: true, feeType: true, event: true }, orderBy: [{ schoolYear: "desc" }] }),
    db.payment.findMany({ orderBy: { date: "desc" }, include: { member: true } }),
    db.operation.findMany({ orderBy: { date: "desc" }, include: { account: true, category: true, transferAccount: true } }),
    db.gradePassage.findMany({ orderBy: { date: "desc" }, include: { member: true, grade: { include: { grid: true } } } }),
    db.result.findMany({ include: { member: true, competition: true } }),
  ]);
  const tutor = (m: (typeof members)[number], rank: number) => {
    const l = m.parents.find((p) => p.rank === rank);
    return l ? `${l.parent.firstName} ${l.parent.lastName} ${ph(l.parent.phone)}`.trim() : "";
  };

  return [
    {
      // Mêmes colonnes que le fichier du club (US-2.6), pour réimport.
      name: "Membres",
      columns: [
        col("Id", "id"), col("Noms", "noms", 20), col("Prénoms", "prenoms", 20), col("Sexe", "sexe"), col("Date_Naissance", "naissance"),
        col("Lieu_Naissance", "lieu"), col("Nationalite", "nationalite"), col("Groupe_Sangin", "sang"), col("Adresse", "adresse", 30),
        col("Contact", "contact", 18), col("TUTEUR1", "t1", 30), col("TUTEUR2", "t2", 30), col("Mail", "mail", 24), col("FB", "fb"),
        col("Date_inscription", "inscription"), col("Statut", "statut"), col("Poste", "poste"), col("Groupe", "groupe"),
        col("Licence", "licence"), col("Kukkiwon", "kukkiwon"), col("Archivé", "archive"),
      ],
      rows: members.map((m) => ({
        id: m.matricule, noms: m.lastName, prenoms: m.firstName, sexe: SEXES[m.sex as keyof typeof SEXES] ?? m.sex,
        naissance: d(m.birthDate), lieu: m.birthPlace ?? "", nationalite: m.nationality, sang: m.bloodGroup ?? "",
        adresse: m.address ?? "", contact: ph(m.phone), t1: tutor(m, 1), t2: tutor(m, 2), mail: m.email ?? "", fb: m.facebook ?? "",
        inscription: d(m.joinedAt), statut: MEMBER_STATUSES[m.status as keyof typeof MEMBER_STATUSES] ?? m.status,
        poste: POSITIONS[m.position as keyof typeof POSITIONS] ?? m.position, groupe: m.group?.name ?? "",
        licence: m.licenseNo ?? "", kukkiwon: m.kukkiwonNo ?? "", archive: m.archived ? "Oui" : "",
      })),
    },
    {
      name: "Parents",
      columns: [col("Nom", "nom", 20), col("Prénom", "prenom", 20), col("Téléphone", "tel", 18), col("Email", "email", 24), col("Enfants", "enfants", 40)],
      rows: parents.map((p) => ({
        nom: p.lastName, prenom: p.firstName, tel: ph(p.phone), email: p.email ?? "",
        enfants: p.children.map((c) => `${c.member.firstName} ${c.member.lastName} (${c.member.matricule})`).join(", "),
      })),
    },
    {
      name: "Séances",
      columns: [col("Date", "date"), col("Titre", "titre", 28), col("Début", "debut"), col("Fin", "fin"), col("Groupe", "groupe"), col("Lieu", "lieu", 20), col("Statut", "statut")],
      rows: sessions.map((s) => ({
        date: d(s.date), titre: s.title, debut: s.startTime ?? "", fin: s.endTime ?? "", groupe: s.group?.name ?? "Tous",
        lieu: s.location ?? "", statut: s.status === "CLOSED" ? "Clôturée" : "Ouverte",
      })),
    },
    {
      name: "Présences",
      columns: [col("Date", "date"), col("Séance / événement", "quoi", 30), col("Matricule", "matricule"), col("Membre", "membre", 28), col("Statut", "statut"), col("Heure", "heure"), col("Mode", "mode")],
      rows: attendances.map((a) => ({
        date: d(a.session?.date ?? a.eventDay?.date), quoi: a.session?.title ?? a.eventDay?.event.title ?? "",
        matricule: a.member.matricule, membre: `${a.member.firstName} ${a.member.lastName}`,
        statut: a.status === "PRESENT" ? "Présent" : a.status === "EXCUSED" ? "Excusé" : "Absent",
        heure: a.scannedAt ? a.scannedAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "", mode: a.mode === "QR" ? "QR" : "Manuel",
      })),
    },
    {
      name: "Événements",
      columns: [col("Début", "debut"), col("Fin", "fin"), col("Titre", "titre", 28), col("Type", "type", 18), col("Lieu", "lieu", 20), col("Inscrits", "inscrits"), col("Frais (Ar)", "frais"), col("Annulé", "annule")],
      rows: events.map((e) => ({
        debut: d(e.startDate), fin: d(e.endDate), titre: e.title, type: e.type.label, lieu: e.location ?? "",
        inscrits: e._count.registrations, frais: e.fee ?? "", annule: e.cancelled ? "Oui" : "",
      })),
    },
    {
      name: "Échéances",
      columns: [col("Année", "annee"), col("Type", "type"), col("Mois", "mois"), col("Événement", "event", 24), col("Matricule", "matricule"), col("Membre", "membre", 28), col("Dû (Ar)", "du"), col("Payé (Ar)", "paye"), col("Statut", "statut")],
      rows: dues.map((x) => ({
        annee: x.schoolYear, type: x.feeType.label, mois: x.month || "", event: x.event?.title ?? "", matricule: x.member.matricule,
        membre: `${x.member.firstName} ${x.member.lastName}`, du: x.amountDue, paye: x.amountPaid,
        statut: x.status === "PAID" ? "Payé" : x.status === "PARTIAL" ? "Partiel" : "Non payé",
      })),
    },
    {
      name: "Paiements",
      columns: [col("Reçu", "recu", 16), col("Date", "date"), col("Matricule", "matricule"), col("Membre", "membre", 28), col("Montant (Ar)", "montant"), col("Mode", "mode"), col("Opérateur", "operateur"), col("Référence", "ref", 18), col("Note", "note", 24), col("Annulé", "annule"), col("Motif d'annulation", "motif", 24)],
      rows: payments.map((p) => ({
        recu: p.receiptNo, date: d(p.date), matricule: p.member.matricule, membre: `${p.member.firstName} ${p.member.lastName}`,
        montant: p.totalAmount, mode: p.method === "CASH" ? "Espèces" : p.method === "MOBILE_MONEY" ? "Mobile Money" : "Virement",
        operateur: p.operator ?? "", ref: p.reference ?? "", note: p.note ?? "", annule: p.cancelled ? "Oui" : "", motif: p.cancelReason ?? "",
      })),
    },
    {
      name: "Opérations",
      columns: [col("Date", "date"), col("Compte", "compte", 16), col("Type", "type"), col("Catégorie", "categorie", 22), col("Montant (Ar)", "montant"), col("Tiers", "tiers", 22), col("Description", "desc", 30), col("Vers le compte", "vers", 16), col("Statut", "statut"), col("Annulée", "annulee")],
      rows: operations.map((o) => ({
        date: d(o.date), compte: o.account.name, type: o.type === "INCOME" ? "Recette" : o.type === "EXPENSE" ? "Dépense" : "Virement",
        categorie: o.category?.name ?? "", montant: o.amount, tiers: o.counterparty ?? "", desc: o.description ?? "",
        vers: o.transferAccount?.name ?? "", statut: o.status === "APPROVED" ? "Validée" : o.status === "PENDING" ? "À valider" : "Refusée",
        annulee: o.cancelled ? "Oui" : "",
      })),
    },
    {
      name: "Grades",
      columns: [col("Date", "date"), col("Matricule", "matricule"), col("Membre", "membre", 28), col("Grille", "grille"), col("Grade", "grade", 26), col("Jury", "jury", 20), col("Mention", "mention"), col("Certificat", "certificat")],
      rows: passages.map((p) => ({
        date: d(p.date), matricule: p.member.matricule, membre: `${p.member.firstName} ${p.member.lastName}`, grille: p.grade.grid.name,
        grade: `${p.grade.number}${p.grade.number === 1 ? "er" : "e"} ${p.grade.kind.toLowerCase()} — ${p.grade.beltLabel}`,
        jury: p.jury ?? "", mention: p.mention ?? "", certificat: p.certificate ?? "",
      })),
    },
    {
      name: "Résultats",
      columns: [col("Date", "date"), col("Compétition", "competition", 28), col("Niveau", "niveau"), col("Matricule", "matricule"), col("Membre", "membre", 28), col("Épreuve", "epreuve"), col("Catégorie", "categorie"), col("Poids", "poids"), col("Résultat", "resultat"), col("Rang", "rang")],
      rows: results.map((r) => ({
        date: d(r.competition.startDate), competition: r.competition.name, niveau: r.competition.level, matricule: r.member.matricule,
        membre: `${r.member.firstName} ${r.member.lastName}`, epreuve: r.discipline, categorie: r.ageCategory ?? "", poids: r.weightCategory ?? "",
        resultat: { GOLD: "Or", SILVER: "Argent", BRONZE: "Bronze", RANK: "Classé", PARTICIPATION: "Participation", ELIMINATED: "Éliminé" }[r.outcome] ?? r.outcome,
        rang: r.rank ?? "",
      })),
    },
  ];
}

export const exportFilename = () => {
  const t = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `gph-export-${t.getFullYear()}${p(t.getMonth() + 1)}${p(t.getDate())}-${p(t.getHours())}${p(t.getMinutes())}.xlsx`;
};

