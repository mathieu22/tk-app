// Calendrier mensuel réutilisable (US-1.12) : grille lundi → dimanche sur ordinateur,
// liste par jour sur téléphone. Composant serveur (aucune interactivité propre).
import Link from "next/link";

export type CalendarItem = { id: string; date: Date; title: string; color: string; href: string; time?: string | null };

const WEEKDAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** Grille de 6 semaines (42 jours) couvrant le mois, alignée sur lundi. */
function monthGrid(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const startOffset = (first.getDay() + 6) % 7; // 0 = lundi
  const start = new Date(first);
  start.setDate(first.getDate() - startOffset);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

export function CalendarMonth({ month, items, today = new Date() }: { month: Date; items: CalendarItem[]; today?: Date }) {
  const days = monthGrid(month);
  const itemsOn = (d: Date) => items.filter((it) => sameDay(it.date, d)).sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));
  const inMonth = (d: Date) => d.getMonth() === month.getMonth();
  const daysWithItems = days.filter((d) => inMonth(d) && itemsOn(d).length > 0);

  return (
    <div>
      {/* Grille — ordinateur */}
      <div className="hidden lg:block">
        <div className="mb-1 grid grid-cols-7 gap-1 text-center text-xs font-bold text-ink-3">
          {WEEKDAY_LABELS.map((w) => <div key={w} className="py-1">{w}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((d, i) => {
            const dayItems = itemsOn(d);
            const shown = dayItems.slice(0, 3);
            return (
              <div key={i} className={`min-h-[104px] rounded-lg border p-1.5 ${inMonth(d) ? "border-divider bg-card" : "border-transparent bg-track/40"}`}>
                <div className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${sameDay(d, today) ? "bg-primary text-white" : inMonth(d) ? "text-ink" : "text-ink-3"}`}>
                  {d.getDate()}
                </div>
                <div className="flex flex-col gap-0.5">
                  {shown.map((it) => (
                    <Link key={it.id} href={it.href} className="truncate rounded px-1 py-0.5 text-[10px] font-semibold text-white" style={{ background: it.color }} title={it.title}>
                      {it.title}
                    </Link>
                  ))}
                  {dayItems.length > shown.length && <div className="px-1 text-[10px] font-semibold text-ink-3">+{dayItems.length - shown.length}</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Liste par jour — téléphone */}
      <div className="flex flex-col gap-2.5 lg:hidden">
        {daysWithItems.length === 0 && <div className="gph-card p-6 text-center text-sm text-ink-3">Aucune séance ni événement ce mois-ci.</div>}
        {daysWithItems.map((d) => (
          <div key={d.toISOString()} className="gph-card p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-bold text-ink-3">
              <span className={`flex h-6 w-6 items-center justify-center rounded-full ${sameDay(d, today) ? "bg-primary text-white" : ""}`}>{d.getDate()}</span>
              {d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
            </div>
            <div className="flex flex-col gap-1.5">
              {itemsOn(d).map((it) => (
                <Link key={it.id} href={it.href} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-bg">
                  <span className="h-2 w-2 flex-none rounded-full" style={{ background: it.color }} />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{it.title}</span>
                  {it.time && <span className="flex-none text-xs font-medium text-ink-3">{it.time.replace(":", "h")}</span>}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
