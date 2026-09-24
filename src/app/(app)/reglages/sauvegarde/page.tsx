import { Database, Download, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { Card, SettingsHeader } from "@/components/settings-ui";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/dal";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Sauvegarde et export" };

export default async function BackupPage() {
  await requirePermission("settings");
  const [lastExport, lastBackup] = await Promise.all([
    db.auditLog.findFirst({ where: { action: "export.full" }, orderBy: { at: "desc" } }),
    db.auditLog.findFirst({ where: { action: "backup.run" }, orderBy: { at: "desc" } }),
  ]);
  const cronConfigured = !!process.env.CRON_SECRET && process.env.CRON_SECRET.length >= 16;

  return (
    <>
      <SettingsHeader title="Sauvegarde et export" sub="Export complet des données et sauvegarde automatique quotidienne" />
      <div className="grid gap-4 px-4 lg:grid-cols-2 lg:items-start">
        <Card title="Export complet">
          <p className="mb-3 text-sm text-ink-2">
            Génère un classeur Excel avec toutes les données : membres, parents, séances, présences, événements,
            échéances, paiements, opérations de trésorerie, grades et résultats.
          </p>
          {lastExport && (
            <p className="mb-3 text-xs text-ink-3">
              Dernier export : {formatDate(lastExport.at)} {lastExport.at.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
          <a href="/api/reglages/export" className="gph-btn-primary full">
            <Download size={16} strokeWidth={2.5} /> Télécharger l&apos;export (.xlsx)
          </a>
        </Card>

        <Card title="Sauvegarde automatique quotidienne">
          <div className="mb-3 flex items-center gap-2">
            <span className={`gph-badge ${cronConfigured ? "success" : "warning"}`}>
              <ShieldCheck size={12} strokeWidth={3} /> {cronConfigured ? "Configurée" : "Non configurée"}
            </span>
          </div>
          <p className="mb-2 text-sm text-ink-2">
            Une tâche planifiée (<code>vercel.json</code>) appelle chaque jour à 1h00 la route{" "}
            <code>/api/cron/backup</code>, protégée par la variable d&apos;environnement <code>CRON_SECRET</code>{" "}
            (Vercel l&apos;envoie automatiquement en en-tête <code>Authorization</code>).
          </p>
          {!cronConfigured && (
            <p className="mb-2 rounded-xl bg-[var(--gph-warning-soft)] px-3 py-2 text-xs font-medium text-[var(--gph-warning-ink)]">
              Définissez <code>CRON_SECRET</code> (16 caractères minimum) dans les variables d&apos;environnement du
              projet Vercel pour activer la sauvegarde quotidienne.
            </p>
          )}
          <p className="mb-3 text-xs text-ink-3">
            Sans stockage externe configuré, la route renvoie le fichier à l&apos;appelant et journalise
            l&apos;exécution ; pour conserver les fichiers, brancher un stockage (Supabase Storage, S3…) dans{" "}
            <code>src/app/api/cron/backup/route.ts</code>.
          </p>
          {lastBackup && (
            <p className="flex items-center gap-1.5 text-xs text-ink-3">
              <Database size={13} /> Dernière exécution : {formatDate(lastBackup.at)}{" "}
              {lastBackup.at.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
              {lastBackup.details && ` — ${lastBackup.details}`}
            </p>
          )}
        </Card>
      </div>
    </>
  );
}
