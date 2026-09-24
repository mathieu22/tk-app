import type { Metadata } from "next";
import { SettingsResendButton } from "@/components/settings-resend";
import { SettingsHeader } from "@/components/settings-ui";
import { FilterChips } from "@/components/ui";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/dal";
import { formatDate, formatPhone } from "@/lib/format";

export const metadata: Metadata = { title: "Messages" };

const STATUS = {
  QUEUED: { label: "En attente", tone: "warning" },
  SENT: { label: "Envoyé", tone: "success" },
  FAILED: { label: "Échec", tone: "danger" },
} as const;
const FILTERS = [
  { value: "tous", label: "Tous" }, { value: "QUEUED", label: "En attente" }, { value: "SENT", label: "Envoyés" }, { value: "FAILED", label: "Échecs" },
];

/**
 * Les messages remis (SENT) sont masqués : un administrateur ne doit pas pouvoir réutiliser
 * le code SMS ou le lien d'activation d'un autre utilisateur. En attente (sans passerelle), ils restent lisibles.
 */
const mask = (body: string) => body.replace(/\/activation\/[\w-]+/g, "/activation/••••••").replace(/\b\d{6}\b/g, "••••••");

export default async function MessagesPage(props: PageProps<"/reglages/messages">) {
  await requirePermission("settings");
  const sp = await props.searchParams;
  const filter = FILTERS.some((f) => f.value === sp.statut) ? String(sp.statut) : "tous";
  const messages = await db.outboundMessage.findMany({
    where: filter === "tous" ? {} : { status: filter }, orderBy: { createdAt: "desc" }, take: 100,
  });
  const gateway = !!process.env.SMS_GATEWAY_URL;
  return (
    <>
      <SettingsHeader title="Messages" sub="SMS et emails générés par l'application (invitations, codes, notifications)" />
      {!gateway && (
        <p className="mx-4 mb-3 rounded-xl bg-[var(--gph-warning-soft)] px-3.5 py-2.5 text-[13px] font-medium text-[var(--gph-warning-ink)]">
          Aucune passerelle SMS configurée (<code>SMS_GATEWAY_URL</code>) : les messages restent « En attente ». Transmettez-les manuellement si besoin.
        </p>
      )}
      <div className="px-4 pb-3">
        <FilterChips options={FILTERS} active={filter} hrefFor={(v) => `/reglages/messages?statut=${v}`} />
      </div>
      <div className="flex flex-col gap-2 px-4">
        {messages.map((m) => {
          const s = STATUS[m.status as keyof typeof STATUS] ?? STATUS.QUEUED;
          return (
            <div key={m.id} className="gph-card p-3.5">
              <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs font-semibold text-ink-3">
                <span className="gph-badge neutral">{m.channel}</span>
                <span>{m.channel === "SMS" ? formatPhone(m.to) : m.to}</span>
                <span>· {formatDate(m.createdAt)} {m.createdAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
                <span className={`gph-badge ${s.tone} ml-auto`}>{s.label}</span>
              </div>
              {m.subject && <div className="text-sm font-bold">{m.subject}</div>}
              <p className="whitespace-pre-wrap break-words text-sm text-ink-2">{m.status === "SENT" ? mask(m.body) : m.body}</p>
              {m.error && <p className="mt-1 text-xs font-semibold text-danger">{m.error}</p>}
              {m.status !== "SENT" && gateway && <div className="mt-2"><SettingsResendButton id={m.id} /></div>}
            </div>
          );
        })}
        {messages.length === 0 && <div className="gph-card p-6 text-center text-sm text-ink-3">Aucun message.</div>}
      </div>
    </>
  );
}
