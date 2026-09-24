"use client";
// Formulaire « Nouveau paiement » (design écran 11, spec US-3.4).
import { AlertTriangle, Check, ChevronRight, Search } from "lucide-react";
import { useActionState, useMemo, useState, useTransition } from "react";
import { createPayment, getMemberDues, type MemberDue } from "@/app/actions/payments";
import { Avatar } from "@/components/avatar";
import { Icon } from "@/components/icon";
import { FEE_META, OPERATORS, PAYMENT_METHODS, type FeeCode, type PaymentMethod } from "@/lib/domain";
import { formatAriary, schoolMonths } from "@/lib/format";
import { MONTH_SHORT } from "../months";

type MemberOption = { id: string; name: string; matricule: string; role: string; phone: string; photoUrl: string | null };

const FEES: { code: FeeCode; label: string }[] = [
  { code: "DROIT", label: "Droit" },
  { code: "PASSPORT", label: "Passport" },
  { code: "ECOLAGE", label: "Écolage" },
  { code: "EVENT", label: "Événement" },
];

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const outstanding = (d: MemberDue) => Math.max(0, d.amountDue - d.amountPaid);

function FieldError({ msg }: { msg?: string }) {
  return msg ? <p className="-mt-2.5 mb-3 text-xs font-semibold text-[var(--gph-danger-ink)]">{msg}</p> : null;
}

export function PaymentForm({ currentSchoolYear, members, initial }: {
  currentSchoolYear: string;
  members: MemberOption[];
  initial: { memberId: string | null; feeCode: FeeCode; schoolYear: string; months: number[]; eventId: string | null; dues: MemberDue[] };
}) {
  const [state, formAction, pending] = useActionState(createPayment, undefined);
  const [loadingDues, startLoading] = useTransition();

  const [memberId, setMemberId] = useState(initial.memberId);
  const [query, setQuery] = useState("");
  const [dues, setDues] = useState(initial.dues);
  const [feeCode, setFeeCode] = useState<FeeCode>(initial.feeCode);
  const [schoolYear, setSchoolYear] = useState(initial.schoolYear);
  const [months, setMonths] = useState<number[]>(initial.months);
  const [amountText, setAmountText] = useState<string | null>(null); // null = montant dû calculé
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [operator, setOperator] = useState("MVOLA"); // opérateur le plus courant, présélectionné
  const [eventId, setEventId] = useState(initial.eventId);
  const [credit, setCredit] = useState(false);
  const [reference, setReference] = useState("");
  const [date, setDate] = useState(todayISO);
  const [note, setNote] = useState("");

  const member = members.find((m) => m.id === memberId) ?? null;
  const meta = FEE_META[feeCode];
  const monthly = feeCode === "ECOLAGE";
  const isEvent = feeCode === "EVENT";
  const fe = state?.fieldErrors ?? {};
  const eventDues = dues.filter((d) => d.feeCode === "EVENT" && d.eventId);
  const currentEvent = eventDues.find((d) => d.eventId === eventId) ?? eventDues.find((d) => d.status !== "PAID") ?? null;
  // L'onglet Événement n'apparaît que si le membre a des frais d'événement.
  const fees = FEES.filter((f) => f.code !== "EVENT" || eventDues.length > 0 || isEvent);

  // Années disponibles pour ce type (échéances existantes du membre).
  const years = useMemo(() => {
    const ys = [...new Set(dues.filter((d) => d.feeCode === feeCode).map((d) => d.schoolYear))].sort();
    return ys.length ? ys : [currentSchoolYear];
  }, [dues, feeCode, currentSchoolYear]);
  const year = years.includes(schoolYear) ? schoolYear : years.includes(currentSchoolYear) ? currentSchoolYear : years.at(-1)!;

  const dueFor = (month: number) =>
    isEvent
      ? (month === 0 ? currentEvent ?? undefined : undefined)
      : dues.find((d) => d.feeCode === feeCode && d.schoolYear === year && d.month === month);
  const selectableMonth = (m: number) => {
    const d = dueFor(m);
    return !!d && d.status !== "PAID";
  };
  const selectedMonths = monthly ? months.filter(selectableMonth) : [];
  const selectedDues = (monthly ? selectedMonths.map(dueFor) : [dueFor(0)]).filter((d): d is MemberDue => !!d);
  const annualPaid = !monthly && selectedDues[0]?.status === "PAID";
  // Tarif du membre (tarif de son groupe s'il existe) : montant dû d'une échéance de la période.
  const tariff = isEvent ? 0 : (dues.find((d) => d.feeCode === feeCode && d.schoolYear === year)?.amountDue ?? 0);
  const due = selectedDues.reduce((n, d) => n + outstanding(d), 0);
  const amount = amountText === null ? due : Number(amountText.replace(/\D/g, "")) || 0;

  const resetAmount = () => setAmountText(null);

  function pickMember(id: string) {
    setMemberId(id);
    setQuery("");
    resetAmount();
    setDues([]);
    setEventId(null);
    startLoading(async () => setDues(await getMemberDues(id)));
  }

  function toggleMonth(m: number) {
    setMonths((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
    resetAmount();
  }

  const needle = query.trim().toLowerCase();
  const results = needle
    ? members
        .filter((m) => m.name.toLowerCase().includes(needle) || m.matricule.toLowerCase().includes(needle) || m.phone.replace(/\s/g, "").includes(needle.replace(/\s/g, "")))
        .slice(0, 8)
    : [];

  const canSubmit = !!member && selectedDues.length > 0 && !annualPaid && amount > 0 && !pending && !loadingDues;

  return (
    <form action={formAction}>
      <input type="hidden" name="memberId" value={memberId ?? ""} />
      <input type="hidden" name="feeCode" value={feeCode} />
      <input type="hidden" name="schoolYear" value={year} />
      <input type="hidden" name="months" value={selectedMonths.join(",")} />
      <input type="hidden" name="amount" value={String(amount)} />
      <input type="hidden" name="method" value={method} />
      <input type="hidden" name="operator" value={method === "MOBILE_MONEY" ? operator : ""} />
      <input type="hidden" name="eventId" value={isEvent ? currentEvent?.eventId ?? "" : ""} />
      <input type="hidden" name="credit" value={credit && due > 0 && amount > due ? "1" : ""} />

      <div className="px-4 pb-32 md:pb-4">
        {/* Membre */}
        <label className="gph-label" htmlFor="member-search">Membre</label>
        {member ? (
          <button type="button" onClick={() => setMemberId(null)} className="gph-card mb-3.5 flex w-full items-center gap-3 p-2.5 text-left" aria-label="Changer de membre">
            <Avatar name={member.name} size={44} photoUrl={member.photoUrl} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{member.name}</div>
              <div className="truncate text-xs font-medium text-ink-3">{[member.role, member.phone].filter(Boolean).join(" · ")}</div>
            </div>
            <ChevronRight size={18} className="text-ink-3" />
          </button>
        ) : (
          <div className="relative mb-3.5">
            <Search size={16} className="absolute left-3.5 top-[26px] -translate-y-1/2 text-ink-3" />
            <input
              id="member-search" type="search" autoComplete="off" autoFocus value={query}
              onChange={(e) => setQuery(e.target.value)} placeholder="Nom, matricule ou téléphone"
              className="gph-input with-icon" aria-invalid={!!fe.memberId}
            />
            {results.length > 0 && (
              <div className="gph-card mt-1.5 overflow-hidden p-0" role="listbox">
                {results.map((m, i) => (
                  <button
                    key={m.id} type="button" role="option" aria-selected={false} onClick={() => pickMember(m.id)}
                    className={`flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-bg ${i < results.length - 1 ? "border-b border-divider" : ""}`}
                  >
                    <Avatar name={m.name} size={32} photoUrl={m.photoUrl} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{m.name}</div>
                      <div className="truncate text-xs text-ink-3">{m.matricule}{m.phone && ` · ${m.phone}`}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {needle && results.length === 0 && <p className="mt-2 text-xs text-ink-3">Aucun membre trouvé.</p>}
          </div>
        )}
        <FieldError msg={fe.memberId} />

        {/* Type de frais */}
        <span className="gph-label">Type de paiement</span>
        <div className="mb-4 flex gap-2">
          {fees.map((f) => {
            const m = FEE_META[f.code];
            const sel = feeCode === f.code;
            return (
              <button
                key={f.code} type="button" aria-pressed={sel}
                onClick={() => { setFeeCode(f.code); resetAmount(); }}
                className="flex min-w-0 flex-1 flex-col items-center gap-1.5 rounded-xl px-2.5 py-3"
                style={{
                  background: sel ? m.color : "#fff",
                  border: sel ? "1px solid transparent" : "1px solid var(--gph-divider)",
                  color: sel ? "#fff" : "var(--gph-ink)",
                  boxShadow: sel ? "0 8px 18px rgba(0,0,0,0.15)" : "none",
                }}
              >
                <Icon name={m.icon} size={20} color={sel ? "#fff" : m.color} />
                <span className="text-xs font-bold">{f.label}</span>
              </button>
            );
          })}
        </div>

        {/* Période */}
        {isEvent && (
          <>
            <span className="gph-label">Événement</span>
            <div className="mb-4 flex flex-col gap-2">
              {eventDues.length === 0 && <p className="text-xs font-semibold text-ink-3">Aucun frais d&apos;événement pour ce membre.</p>}
              {eventDues.map((d) => {
                const sel = d.eventId === currentEvent?.eventId;
                const paid = d.status === "PAID";
                return (
                  <button
                    key={d.eventId} type="button" disabled={paid} aria-pressed={sel}
                    onClick={() => { setEventId(d.eventId); resetAmount(); }}
                    className="flex items-center justify-between gap-3 rounded-xl px-3.5 py-3 text-left text-sm font-bold disabled:cursor-not-allowed"
                    style={{
                      background: sel && !paid ? meta.color : paid ? "var(--gph-track)" : "#fff",
                      color: sel && !paid ? "#fff" : paid ? "var(--gph-ink-3)" : "var(--gph-ink)",
                      border: sel && !paid ? "1px solid transparent" : "1px solid var(--gph-divider)",
                    }}
                  >
                    <span className="min-w-0 truncate">{d.eventTitle}</span>
                    <span className="gph-amount flex-none text-xs">
                      {paid ? "Payé" : d.amountPaid > 0 ? `${formatAriary(d.amountPaid)} / ${formatAriary(d.amountDue)}` : formatAriary(d.amountDue)}
                    </span>
                  </button>
                );
              })}
            </div>
            <FieldError msg={fe.eventId} />
          </>
        )}

        {!isEvent && (!monthly || years.length > 1) && (
          <>
            <span className="gph-label">Année</span>
            <div className="mb-4 flex gap-2">
              {years.map((y) => {
                const sel = y === year;
                return (
                  <button
                    key={y} type="button" aria-pressed={sel}
                    onClick={() => { setSchoolYear(y); resetAmount(); }}
                    className="flex-1 rounded-xl px-3.5 py-3 text-center text-sm font-bold"
                    style={{
                      background: sel ? meta.color : "#fff",
                      color: sel ? "#fff" : "var(--gph-ink)",
                      border: sel ? "1px solid transparent" : "1px solid var(--gph-divider)",
                    }}
                  >
                    {y}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {monthly && (
          <>
            <span className="gph-label">
              Mois <span className="opt">· sélection multiple</span>
            </span>
            <div className="mb-2 grid grid-cols-4 gap-1.5">
              {schoolMonths().map((m) => {
                const d = dueFor(m);
                const paid = d?.status === "PAID";
                const partial = d?.status === "PARTIAL";
                const disabled = !d || paid;
                const sel = !disabled && months.includes(m);
                return (
                  <button
                    key={m} type="button" disabled={disabled} aria-pressed={sel} onClick={() => toggleMonth(m)}
                    title={paid ? "Déjà payé" : partial ? `Partiel : ${formatAriary(d.amountPaid)} / ${formatAriary(d.amountDue)}` : undefined}
                    className="relative rounded-[10px] py-2.5 text-center text-[13px] font-bold disabled:cursor-not-allowed"
                    style={{
                      background: sel ? meta.color : disabled ? "var(--gph-track)" : "#fff",
                      color: sel ? "#fff" : disabled ? "var(--gph-ink-3)" : "var(--gph-ink)",
                      border: sel ? "1px solid transparent" : partial ? "1px solid var(--gph-warning)" : "1px solid var(--gph-divider)",
                      textDecoration: paid ? "line-through" : undefined,
                    }}
                  >
                    {MONTH_SHORT[m]}
                    {sel && (
                      <span className="absolute right-[3px] top-[3px] flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white/30">
                        <Check size={10} strokeWidth={3.5} />
                      </span>
                    )}
                    {!sel && partial && <span className="gph-dot absolute right-1 top-1 !h-1.5 !w-1.5" style={{ background: "var(--gph-warning)" }} />}
                  </button>
                );
              })}
            </div>
            <p className="mb-4 flex flex-wrap gap-x-3 text-[11px] font-semibold text-ink-3">
              <span className="line-through">Payé</span>
              <span className="text-[var(--gph-warning-ink)]">● Partiel</span>
            </p>
            <FieldError msg={fe.months} />
          </>
        )}

        {member && loadingDues && <p className="mb-4 text-xs font-semibold text-ink-3">Chargement des échéances…</p>}
        {annualPaid && !isEvent && (
          <p className="gph-badge success mb-4 w-full justify-center py-2.5 text-[13px]">
            <Check size={14} strokeWidth={3} /> {FEES.find((f) => f.code === feeCode)?.label} {year} déjà payé
          </p>
        )}

        {/* Montant */}
        <label className="gph-label" htmlFor="amount">
          Montant {due > 0 && <span className="opt">· dû : {formatAriary(due)}</span>}
          {tariff > 0 && <span className="opt"> · tarif applicable : {formatAriary(tariff)}{monthly ? "/mois" : ""}</span>}
        </label>
        <div className="relative mb-4">
          <input
            id="amount" inputMode="numeric" autoComplete="off"
            value={amount ? amount.toLocaleString("fr-FR").replace(/\s/g, " ") : ""}
            onChange={(e) => setAmountText(e.target.value)}
            className="gph-input gph-amount pr-12 text-[22px] font-bold text-finance"
            aria-invalid={!!fe.amount}
          />
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-ink-3">Ar</span>
        </div>
        <FieldError msg={fe.amount} />
        {due > 0 && amount > due && (
          <p className="-mt-2 mb-4 flex items-start gap-1.5 text-xs font-semibold text-[var(--gph-warning-ink)]">
            <AlertTriangle size={14} className="mt-px flex-none" />
            Montant supérieur au dû ({formatAriary(due)}). Le surplus de {formatAriary(amount - due)} sera affecté à la dernière échéance.
          </p>
        )}
        {due > 0 && amount > due && (
          <label className="-mt-2 mb-4 flex items-center gap-2 text-xs font-semibold text-ink-2">
            <input type="checkbox" checked={credit} onChange={(e) => setCredit(e.target.checked)} className="h-4 w-4 accent-[var(--gph-primary)]" />
            Enregistrer le surplus comme avoir (mention sur le reçu)
          </label>
        )}
        {due > 0 && amount > 0 && amount < due && (
          <p className="-mt-2 mb-4 text-xs font-semibold text-ink-3">Paiement partiel : réparti du mois le plus ancien au plus récent.</p>
        )}

        {/* Mode de paiement */}
        <span className="gph-label">Mode de paiement</span>
        <div className="mb-4 grid grid-cols-3 gap-2">
          {(Object.keys(PAYMENT_METHODS) as PaymentMethod[]).map((id) => {
            const opt = PAYMENT_METHODS[id];
            const sel = method === id;
            return (
              <button
                key={id} type="button" aria-pressed={sel} onClick={() => setMethod(id)}
                className="flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-center"
                style={{
                  border: sel ? "2px solid var(--gph-primary)" : "1px solid var(--gph-divider)",
                  background: sel ? "var(--gph-primary-soft)" : "#fff",
                  color: sel ? "var(--gph-primary)" : "var(--gph-ink-2)",
                }}
              >
                <Icon name={opt.icon} size={20} />
                <span className="text-xs font-semibold">{opt.label}</span>
              </button>
            );
          })}
        </div>

        {method === "MOBILE_MONEY" && (
          <>
            <span className="gph-label">Opérateur</span>
            <div className="mb-4 flex flex-wrap gap-2">
              {Object.entries(OPERATORS).map(([id, label]) => (
                <button key={id} type="button" aria-pressed={operator === id} onClick={() => setOperator(id)} className={`gph-chip${operator === id ? " active" : ""}`}>
                  {operator === id && <Check size={12} strokeWidth={3} />}
                  {label}
                </button>
              ))}
            </div>
            <FieldError msg={fe.operator} />
          </>
        )}

        <label className="gph-label" htmlFor="reference">
          Référence {method === "CASH" ? <span className="opt">· optionnel</span> : <span className="opt">· obligatoire</span>}
        </label>
        <input
          id="reference" name="reference" value={reference} onChange={(e) => setReference(e.target.value)}
          required={method !== "CASH"} maxLength={100} autoComplete="off"
          placeholder={method === "MOBILE_MONEY" ? "ID de transaction" : method === "TRANSFER" ? "Référence du virement" : "N° de bon, etc."}
          className="gph-input mb-4 font-mono" aria-invalid={!!fe.reference}
        />
        <FieldError msg={fe.reference} />

        <label className="gph-label" htmlFor="date">Date du paiement</label>
        <input id="date" name="date" type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} required className="gph-input mb-4" aria-invalid={!!fe.date} />
        <FieldError msg={fe.date} />

        <label className="gph-label" htmlFor="note">
          Note <span className="opt">· optionnel</span>
        </label>
        <input id="note" name="note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Commentaire" className="gph-input" />

        {state?.error && (
          <p role="alert" className="gph-badge danger mt-4 w-full justify-center whitespace-normal py-2.5 text-center text-[13px]">
            {state.error}
          </p>
        )}
      </div>

      {/* CTA fixe (recouvre la barre d'onglets sur téléphone) */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-divider bg-white px-4 pb-[max(24px,env(safe-area-inset-bottom))] pt-3 md:static md:z-auto md:border-none md:bg-transparent md:pb-4">
        <button className="gph-btn-primary full" disabled={!canSubmit}>
          <Check size={18} strokeWidth={2.5} />
          {pending ? "Enregistrement…" : `Confirmer · ${formatAriary(amount)}`}
        </button>
      </div>
    </form>
  );
}
