import { LogOut, Mail, Phone, QrCode, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import QRCode from "qrcode";
import { logout } from "@/app/actions/auth";
import { ScreenHeader, SectionTitle } from "@/components/ui";
import { isMinor } from "@/lib/categories";
import { db } from "@/lib/db";
import { requireUser, visibleMemberIds } from "@/lib/dal";
import { fullName } from "@/lib/domain";
import { formatPhone } from "@/lib/format";
import { newQrToken } from "@/lib/qr";
import { ConsentToggle, PasswordForm } from "./profile-forms";

export const metadata: Metadata = { title: "Profil" };

const PROFILE_LABELS: Record<string, string> = { PARENT: "Parent", ATHLETE: "Athlète" };

export default async function ProfilePage() {
  const user = await requireUser();
  const ids = await visibleMemberIds(user);
  const members = ids === "ALL" ? [] : await db.member.findMany({ where: { id: { in: ids }, archived: false }, orderBy: { firstName: "asc" } });

  // QR du compte parent pour le pointage aux réunions des parents (généré au premier affichage)
  let parentQr: string | null = null;
  if (user.parentId) {
    const parent = await db.parent.findUniqueOrThrow({ where: { id: user.parentId } });
    const token = parent.qrToken ?? (await db.parent.update({ where: { id: parent.id }, data: { qrToken: newQrToken() } })).qrToken!;
    parentQr = await QRCode.toString(`TKD1P:${token}`, { type: "svg", margin: 1, width: 220, color: { dark: "#1A1A2E" } });
  }
  // Consentement photo : le parent pour ses enfants, l'athlète majeur pour lui-même
  const consentFor = members.filter((m) => user.profile === "PARENT" || !isMinor(m.birthDate));

  return (
    <>
      <ScreenHeader title="Profil" sub={PROFILE_LABELS[user.profile] ?? "Prévisualisation staff"} />
      <div className="flex flex-col gap-3.5 px-4 lg:grid lg:grid-cols-2 lg:items-start">
        <div className="flex flex-col gap-3.5">
          <div className="gph-card divide-y divide-divider">
            <Row Icon={Phone} label="Téléphone" value={formatPhone(user.phone)} />
            <Row Icon={Mail} label="Email" value={user.email ?? "—"} />
          </div>

          {consentFor.length > 0 && (
            <section>
              <SectionTitle>Consentement photo</SectionTitle>
              <div className="gph-card divide-y divide-divider">
                {consentFor.map((m) => (
                  <ConsentToggle key={m.id} memberId={m.id} name={fullName(m)} initial={m.photoConsent} />
                ))}
              </div>
              <p className="mt-1.5 px-1 text-xs text-ink-3">
                Autorise le club à utiliser les photos (fiche, palmarès, vitrine publique). Modifiable à tout moment.
              </p>
            </section>
          )}

          <section>
            <SectionTitle>Mot de passe</SectionTitle>
            <PasswordForm />
          </section>
        </div>

        <div className="flex flex-col gap-3.5">
          {parentQr && (
            <section>
              <SectionTitle>Mon QR parent</SectionTitle>
              <div className="gph-card p-3.5">
                <div className="flex items-center gap-2 text-[13px] font-medium text-ink-2">
                  <QrCode size={16} className="text-primary" /> À présenter lors des réunions des parents.
                </div>
                <div className="mx-auto mt-3 w-full max-w-[240px] [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: parentQr }} />
              </div>
            </section>
          )}
          <div className="flex items-start gap-2 rounded-xl bg-primary-soft p-3 text-xs font-medium text-primary">
            <ShieldCheck size={16} className="flex-none" />
            Vous ne voyez que les informations de {user.profile === "PARENT" ? "vos enfants" : "votre fiche"}. Pour toute correction, contactez le secrétariat du club.
          </div>
          <form action={logout}>
            <button className="gph-btn-ghost w-full text-danger"><LogOut size={16} /> Déconnexion</button>
          </form>
        </div>
      </div>
    </>
  );
}

function Row({ Icon, label, value }: { Icon: typeof Phone; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3.5 px-3.5 py-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-primary-soft text-primary"><Icon size={16} /></span>
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-[0.03em] text-ink-3">{label}</div>
        <div className="truncate text-sm font-semibold">{value}</div>
      </div>
    </div>
  );
}
