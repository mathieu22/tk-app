"use client";
// Scanner QR (US-1.3) : caméra arrière, enregistrement automatique, retour visuel / sonore / vibration.
import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser";
import { AlertTriangle, Check, Keyboard, Search, X, Zap, ZapOff } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { scan, searchMembers, type ScanResult } from "@/app/actions/sessions";

type Banner =
  | { tone: "success" | "warning" | "danger"; title: string; name?: string; extra?: string }
  | null;

const TONES = {
  success: { bg: "rgba(16,185,129,0.95)", shadow: "rgba(16,185,129,0.3)", Icon: Check },
  warning: { bg: "rgba(245,158,11,0.95)", shadow: "rgba(245,158,11,0.3)", Icon: AlertTriangle },
  danger: { bg: "rgba(239,68,68,0.95)", shadow: "rgba(239,68,68,0.3)", Icon: X },
};

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

export function Scanner({ sessionId, title, closed, expected, initialPresent }: {
  sessionId: string; title: string; closed: boolean; expected: number; initialPresent: number;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const lastRef = useRef<{ text: string; t: number }>({ text: "", t: 0 });
  const busyRef = useRef(false);
  const [present, setPresent] = useState(initialPresent);
  const [banner, setBanner] = useState<Banner>(null);
  const [confirmOut, setConfirmOut] = useState<Extract<ScanResult, { kind: "outOfGroup" }> | null>(null);
  const [torch, setTorch] = useState<boolean | null>(null); // null = non supporté
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manual, setManual] = useState(false);

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
      setBanner({ tone: ok ? "success" : "warning", title: ok ? "Présence enregistrée" : `Déjà enregistré à ${r.at}`, name: r.name, extra: r.role });
      feedback(ok ? "success" : "warning");
    }
  }, []);

  const submit = useCallback(async (input: Parameters<typeof scan>[1]) => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      handle(await scan(sessionId, input));
    } catch {
      setBanner({ tone: "danger", title: "Erreur réseau : réessayez." });
    } finally {
      busyRef.current = false;
    }
  }, [handle, sessionId]);

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

  const tone = banner ? TONES[banner.tone] : null;

  return (
    <div className="flex h-full flex-col text-white">
      <div className="relative z-10 flex items-center justify-between px-4 pb-3.5 pt-[max(12px,env(safe-area-inset-top))]">
        <Link href={`/presence/${sessionId}`} aria-label="Fermer" className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-white/12 backdrop-blur">
          <X size={18} />
        </Link>
        <div className="min-w-0 text-center">
          <div className="text-[11px] font-semibold uppercase tracking-[0.05em] opacity-65">Session en cours</div>
          <div className="truncate text-sm font-bold">{title}</div>
        </div>
        <button onClick={toggleTorch} disabled={torch === null} aria-label="Lampe torche"
          className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-white/12 backdrop-blur disabled:opacity-40">
          {torch ? <ZapOff size={18} /> : <Zap size={18} />}
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden bg-[radial-gradient(ellipse_at_center,#2a3b2c_0%,#0f1610_70%,#050807_100%)]">
        <video ref={videoRef} muted playsInline className="absolute inset-0 h-full w-full object-cover" />

        <div className="absolute left-1/2 top-4 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/55 px-3.5 py-2 text-[13px] font-bold backdrop-blur">
          <span className="gph-dot" style={{ background: "var(--gph-accent)" }} />
          {present} / {expected} scannés
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
            {banner.tone === "success" && <span className="rounded-lg bg-white/22 px-2 py-1 text-[11px] font-bold">+1</span>}
          </div>
        )}

        <div className="absolute inset-x-4 bottom-6 text-center text-sm font-medium leading-snug text-white/85">
          {closed ? "Séance clôturée : scan impossible." : cameraError ?? (
            <>Placez le QR du membre dans le cadre.<br />La présence est enregistrée automatiquement.</>
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
          <div className="text-[11px] font-bold uppercase tracking-[0.05em] text-[var(--gph-warning-ink)]">Hors groupe de la séance</div>
          <div className="mt-1 text-lg font-bold">{confirmOut.name}</div>
          <div className="text-sm text-ink-3">{confirmOut.role}</div>
          <p className="mt-2 text-sm text-ink-2">Ce membre n&apos;appartient pas au groupe de la séance (ou n&apos;est pas actif). L&apos;ajouter quand même ?</p>
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

      {manual && <ManualEntry sessionId={sessionId} onClose={() => setManual(false)} onPick={(id) => { setManual(false); void submit({ memberId: id }); }} />}
    </div>
  );
}

function Sheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-30 flex items-end bg-black/50" onClick={onClose}>
      <div className="w-full rounded-t-3xl bg-white px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-5 text-ink" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function ManualEntry({ sessionId, onClose, onPick }: { sessionId: string; onClose: () => void; onPick: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ id: string; name: string; role: string }[]>([]);
  useEffect(() => {
    const t = setTimeout(() => { void searchMembers(sessionId, q).then(setResults); }, 200);
    return () => clearTimeout(t);
  }, [q, sessionId]);
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
        {q.trim().length >= 2 && results.length === 0 && <p className="py-4 text-center text-sm text-ink-3">Aucun membre trouvé.</p>}
      </div>
    </Sheet>
  );
}
