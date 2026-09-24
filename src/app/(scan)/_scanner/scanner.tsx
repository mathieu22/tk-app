"use client";
// Scanner QR (US-1.3, US-1.9) : séances et journées d'événement. Caméra arrière, enregistrement
// automatique, retour visuel / sonore / vibration, saisie manuelle, file hors connexion (IndexedDB).
import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser";
import { get, set } from "idb-keyval";
import { AlertTriangle, Check, CloudOff, Keyboard, LogIn, LogOut, Search, X, Zap, ZapOff } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { markParentPresent, scanEvent, searchEventPeople, syncOfflineScans, type OfflineScan } from "@/app/actions/events";
import { scan, searchMembers, type ScanResult } from "@/app/actions/sessions";

type Target = { kind: "session" | "eventDay"; id: string };
type Banner = { tone: "success" | "warning" | "danger"; title: string; name?: string } | null;
type Input = { qr?: string; memberId?: string; force?: boolean; departure?: boolean };

const TONES = {
  success: { bg: "rgba(16,185,129,0.95)", shadow: "rgba(16,185,129,0.3)", Icon: Check },
  warning: { bg: "rgba(245,158,11,0.95)", shadow: "rgba(245,158,11,0.3)", Icon: AlertTriangle },
  danger: { bg: "rgba(239,68,68,0.95)", shadow: "rgba(239,68,68,0.3)", Icon: X },
};

const QUEUE_KEY = "gph-offline-scans";
const readQueue = async () => ((await get<OfflineScan[]>(QUEUE_KEY)) ?? []);

function feedback(tone: "success" | "warning" | "danger") {
  try {
    navigator.vibrate?.(tone === "success" ? 80 : [60, 60, 60]);
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = tone === "success" ? 880 : tone === "warning" ? 520 : 220;
    gain.gain.value = 0.15;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
    osc.onended = () => ctx.close();
  } catch {
    // son / vibration indisponibles : le retour visuel suffit
  }
}

export function Scanner({ target, title, eyebrow = "Session en cours", closed, closedMessage, expected, initialPresent, closeHref, days, allowDeparture }: {
  target: Target;
  title: string;
  eyebrow?: string;
  closed: boolean;
  closedMessage?: string;
  expected: number;
  initialPresent: number;
  closeHref: string;
  days?: { id: string; label: string; href: string }[];
  allowDeparture?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const lastRef = useRef<{ text: string; t: number }>({ text: "", t: 0 });
  const busyRef = useRef(false);
  const departureRef = useRef(false);
  const [present, setPresent] = useState(initialPresent);
  const [banner, setBanner] = useState<Banner>(null);
  const [confirmOut, setConfirmOut] = useState<Extract<ScanResult, { kind: "outOfGroup" }> | null>(null);
  const [torch, setTorch] = useState<boolean | null>(null); // null = non supporté
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
  const [pending, setPending] = useState(0);
  const [departure, setDeparture] = useState(false);
  useEffect(() => {
    departureRef.current = departure;
  }, [departure]);

  // Dépendances sur des chaînes : les props sont recréées à chaque rafraîchissement serveur
  // (revalidatePath), ce qui ne doit pas redémarrer la caméra.
  const { kind, id: targetId } = target;
  const send = useCallback(
    (input: Input & { at?: string }) => (kind === "session" ? scan(targetId, input) : scanEvent(targetId, input)),
    [kind, targetId],
  );

  const handle = useCallback((r: ScanResult) => {
    if ("message" in r) {
      setBanner({ tone: "danger", title: r.message });
      feedback("danger");
    } else if (r.kind === "outOfGroup") {
      setConfirmOut(r);
      feedback("warning");
    } else {
      setPresent(r.present);
      const ok = r.kind === "ok";
      setBanner({ tone: ok ? "success" : "warning", title: r.title ?? (ok ? "Présence enregistrée" : `Déjà enregistré à ${r.at}`), name: r.name });
      feedback(ok ? "success" : "warning");
    }
  }, []);

  // ─── File hors connexion ───
  const enqueue = useCallback(async (input: Input) => {
    const queue = await readQueue();
    // Même QR déjà en attente pour cette cible : pas de doublon
    if (input.qr && queue.some((q) => q.targetId === targetId && q.qr === input.qr && !!q.departure === !!input.departure)) {
      setBanner({ tone: "warning", title: "Déjà en attente de synchronisation" });
      feedback("warning");
      return;
    }
    queue.push({ id: crypto.randomUUID(), kind, targetId, qr: input.qr, memberId: input.memberId, departure: input.departure, at: new Date().toISOString() });
    await set(QUEUE_KEY, queue);
    setPending(queue.length);
    setBanner({ tone: "warning", title: `Enregistré hors connexion (${queue.length} en attente)` });
    feedback("success");
  }, [kind, targetId]);

  const sync = useCallback(async () => {
    const queue = await readQueue();
    setPending(queue.length);
    if (!queue.length || !navigator.onLine) return;
    try {
      const { done, errors } = await syncOfflineScans(queue);
      const rest = (await readQueue()).filter((q) => !done.includes(q.id));
      await set(QUEUE_KEY, rest);
      setPending(rest.length);
      if (done.length) {
        setBanner({
          tone: errors.length ? "warning" : "success",
          title: `${done.length} scan${done.length > 1 ? "s" : ""} synchronisé${done.length > 1 ? "s" : ""}${errors.length ? ` · ${errors.length} QR invalide${errors.length > 1 ? "s" : ""}` : ""}`,
        });
      }
    } catch {
      // toujours hors ligne : nouvelle tentative au prochain événement « online »
    }
  }, []);

  useEffect(() => {
    const on = () => void sync();
    const t = setTimeout(on, 0); // synchronisation au chargement
    window.addEventListener("online", on);
    return () => {
      clearTimeout(t);
      window.removeEventListener("online", on);
    };
  }, [sync]);

  const submit = useCallback(async (input: Input) => {
    if (busyRef.current) return;
    busyRef.current = true;
    const withMode = { ...input, departure: departureRef.current || undefined };
    try {
      if (!navigator.onLine) await enqueue(withMode);
      else handle(await send(withMode));
    } catch {
      await enqueue(withMode); // réseau coupé pendant l'appel
    } finally {
      busyRef.current = false;
    }
  }, [enqueue, handle, send]);

  useEffect(() => {
    if (closed) return;
    const reader = new BrowserQRCodeReader(undefined, { delayBetweenScanAttempts: 150 });
    let cancelled = false;
    reader
      .decodeFromConstraints({ video: { facingMode: "environment" } }, videoRef.current!, (result) => {
        if (!result) return;
        const text = result.getText();
        const now = Date.now();
        // Même QR maintenu devant la caméra : on ignore pendant 3 s.
        if (text === lastRef.current.text && now - lastRef.current.t < 3000) return;
        lastRef.current = { text, t: now };
        void submit({ qr: text });
      })
      .then((controls) => {
        if (cancelled) return controls.stop();
        controlsRef.current = controls;
        if (controls.switchTorch) setTorch(false);
      })
      .catch(() => setCameraError("Caméra indisponible. Autorisez l'accès à la caméra ou utilisez la saisie manuelle."));
    return () => {
      cancelled = true;
      controlsRef.current?.stop();
    };
  }, [closed, submit]);

  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner(null), 2500);
    return () => clearTimeout(t);
  }, [banner]);

  const toggleTorch = async () => {
    if (torch === null || !controlsRef.current?.switchTorch) return;
    await controlsRef.current.switchTorch(!torch);
    setTorch(!torch);
  };

  const pick = async (id: string) => {
    setManual(false);
    if (id.startsWith("parent:")) {
      if (!navigator.onLine) return setBanner({ tone: "danger", title: "Hors connexion : pointage manuel des parents impossible." });
      handle(await markParentPresent(targetId, id.slice(7)));
    } else void submit({ memberId: id });
  };

  const tone = banner ? TONES[banner.tone] : null;

  return (
    <div className="flex h-full flex-col text-white">
      <div className="relative z-10 flex items-center justify-between px-4 pb-3 pt-[max(12px,env(safe-area-inset-top))]">
        <Link href={closeHref} aria-label="Fermer" className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-white/12 backdrop-blur">
          <X size={18} />
        </Link>
        <div className="min-w-0 text-center">
          <div className="text-[11px] font-semibold uppercase tracking-[0.05em] opacity-65">{eyebrow}</div>
          <div className="truncate text-sm font-bold">{title}</div>
        </div>
        <button onClick={toggleTorch} disabled={torch === null} aria-label="Lampe torche"
          className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-white/12 backdrop-blur disabled:opacity-40">
          {torch ? <ZapOff size={18} /> : <Zap size={18} />}
        </button>
      </div>

      {(days?.length || allowDeparture) && (
        <div className="relative z-10 flex flex-col gap-2 px-4 pb-3">
          {days && days.length > 1 && (
            <div className="no-scrollbar flex gap-2 overflow-x-auto">
              {days.map((d) => (
                <Link key={d.id} href={d.href} replace
                  className={`flex-none rounded-full px-3.5 py-1.5 text-xs font-bold ${d.id === target.id ? "bg-[var(--gph-accent)] text-white" : "bg-white/12"}`}>
                  {d.label}
                </Link>
              ))}
            </div>
          )}
          {allowDeparture && (
            <div className="grid grid-cols-2 gap-1 rounded-full bg-white/12 p-1 text-xs font-bold">
              <button onClick={() => setDeparture(false)} aria-pressed={!departure}
                className={`flex items-center justify-center gap-1.5 rounded-full py-1.5 ${!departure ? "bg-white text-ink" : ""}`}>
                <LogIn size={14} /> Arrivée
              </button>
              <button onClick={() => setDeparture(true)} aria-pressed={departure}
                className={`flex items-center justify-center gap-1.5 rounded-full py-1.5 ${departure ? "bg-white text-ink" : ""}`}>
                <LogOut size={14} /> Départ
              </button>
            </div>
          )}
        </div>
      )}

      <div className="relative flex-1 overflow-hidden bg-[radial-gradient(ellipse_at_center,#2a3b2c_0%,#0f1610_70%,#050807_100%)]">
        <video ref={videoRef} muted playsInline className="absolute inset-0 h-full w-full object-cover" />

        <div className="absolute left-1/2 top-4 z-10 flex -translate-x-1/2 flex-col items-center gap-1.5">
          <div className="flex items-center gap-2 rounded-full bg-black/55 px-3.5 py-2 text-[13px] font-bold backdrop-blur">
            <span className="gph-dot" style={{ background: "var(--gph-accent)" }} />
            {present} / {expected} scannés
          </div>
          {pending > 0 && (
            <div className="flex items-center gap-1.5 rounded-full bg-[rgba(245,158,11,0.9)] px-3 py-1 text-[11px] font-bold">
              <CloudOff size={12} /> {pending} en attente de synchronisation
            </div>
          )}
        </div>

        {/* Cadre de visée */}
        <div className="absolute left-1/2 top-1/2 h-60 w-60 -translate-x-1/2 -translate-y-1/2">
          {(["tl", "tr", "bl", "br"] as const).map((c) => {
            const t = c[0] === "t";
            const l = c[1] === "l";
            return (
              <div key={c} className="absolute h-9 w-9" style={{
                [t ? "top" : "bottom"]: -2, [l ? "left" : "right"]: -2,
                [t ? "borderTop" : "borderBottom"]: "4px solid var(--gph-accent)",
                [l ? "borderLeft" : "borderRight"]: "4px solid var(--gph-accent)",
                [`border${t ? "Top" : "Bottom"}${l ? "Left" : "Right"}Radius`]: 18,
                animation: `gph-pulse 2s ${c === "tl" || c === "br" ? "0s" : "0.5s"} ease-in-out infinite`,
              }} />
            );
          })}
          {!closed && !cameraError && (
            <div className="absolute left-2 right-2 h-0.5" style={{
              background: "linear-gradient(90deg, transparent, var(--gph-accent), transparent)",
              boxShadow: "0 0 16px var(--gph-accent)", animation: "gph-scan 2.4s ease-in-out infinite",
            }} />
          )}
        </div>

        {banner && tone && (
          <div role="status" className="absolute inset-x-4 top-[calc(50%+150px)] z-10 flex items-center gap-3 rounded-[14px] px-3.5 py-3 backdrop-blur"
            style={{ background: tone.bg, boxShadow: `0 12px 30px ${tone.shadow}` }}>
            <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-white/22">
              <tone.Icon size={20} strokeWidth={3} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-bold uppercase tracking-[0.05em] opacity-85">{banner.title}</div>
              {banner.name && <div className="mt-px truncate text-[15px] font-bold">{banner.name}</div>}
            </div>
            {banner.tone === "success" && banner.name && <span className="rounded-lg bg-white/22 px-2 py-1 text-[11px] font-bold">+1</span>}
          </div>
        )}

        <div className="absolute inset-x-4 bottom-6 text-center text-sm font-medium leading-snug text-white/85">
          {closed ? (closedMessage ?? "Séance clôturée : scan impossible.") : cameraError ?? (
            <>Placez le QR dans le cadre.<br />La présence est enregistrée automatiquement.</>
          )}
          {!closed && (
            <button onClick={() => setManual(true)} className="mx-auto mt-3 flex items-center gap-2 rounded-full bg-white/12 px-4 py-2.5 text-[13px] font-semibold backdrop-blur">
              <Keyboard size={16} /> Saisie manuelle
            </button>
          )}
        </div>
      </div>

      {confirmOut && (
        <Sheet onClose={() => setConfirmOut(null)}>
          <div className="text-[11px] font-bold uppercase tracking-[0.05em] text-[var(--gph-warning-ink)]">
            {confirmOut.reason ?? "Hors groupe de la séance"}
          </div>
          <div className="mt-1 text-lg font-bold">{confirmOut.name}</div>
          <div className="text-sm text-ink-3">{confirmOut.role}</div>
          <p className="mt-2 text-sm text-ink-2">
            {target.kind === "session"
              ? "Ce membre n'appartient pas au groupe de la séance (ou n'est pas actif). L'ajouter quand même ?"
              : "Ce membre n'est pas inscrit. L'ajouter sur place ?"}
          </p>
          <div className="mt-4 flex gap-2">
            <button className="gph-btn-ghost flex-1" onClick={() => setConfirmOut(null)}>Annuler</button>
            <button className="gph-btn-primary flex-1" onClick={() => {
              const id = confirmOut.memberId;
              setConfirmOut(null);
              void submit({ memberId: id, force: true });
            }}>Ajouter</button>
          </div>
        </Sheet>
      )}

      {manual && <ManualEntry target={target} onClose={() => setManual(false)} onPick={pick} />}
    </div>
  );
}

function Sheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-30 flex items-end bg-black/50 md:items-center md:justify-center" onClick={onClose}>
      <div className="w-full rounded-t-3xl bg-white px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-5 text-ink md:max-w-md md:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function ManualEntry({ target, onClose, onPick }: { target: Target; onClose: () => void; onPick: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ id: string; name: string; role: string }[]>([]);
  const { kind, id } = target;
  useEffect(() => {
    const t = setTimeout(() => {
      const search = kind === "session" ? searchMembers(id, q) : searchEventPeople(id, q);
      void search.then(setResults).catch(() => setResults([]));
    }, 200);
    return () => clearTimeout(t);
  }, [q, kind, id]);
  return (
    <Sheet onClose={onClose}>
      <div className="mb-3 text-base font-bold">Marquer présent</div>
      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un membre" className="gph-input with-icon" />
      </div>
      <div className="mt-2 flex max-h-72 flex-col overflow-y-auto">
        {results.map((m) => (
          <button key={m.id} onClick={() => onPick(m.id)} className="flex items-center justify-between rounded-xl px-2 py-3 text-left hover:bg-bg">
            <span>
              <span className="block text-sm font-semibold">{m.name}</span>
              <span className="text-xs text-ink-3">{m.role}</span>
            </span>
            <span className="gph-badge success">Présent</span>
          </button>
        ))}
        {q.trim().length >= 2 && results.length === 0 && <p className="py-4 text-center text-sm text-ink-3">Aucun résultat (hors connexion ?).</p>}
      </div>
    </Sheet>
  );
}
