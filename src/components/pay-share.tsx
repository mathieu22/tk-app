"use client";
// Partage du reçu (US-3.5) : Web Share API avec le PDF quand le navigateur le permet,
// sinon menu WhatsApp / SMS / email avec un message pré-rédigé.
import { Mail, MessageCircle, MessageSquare, Share2 } from "lucide-react";
import { useState } from "react";

export function ShareReceipt({ pdfUrl, filename, text, phone, email }: {
  pdfUrl: string; filename: string; text: string; phone?: string | null; email?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const digits = phone?.replace(/\D/g, "") ?? "";
  const enc = encodeURIComponent(text);

  async function share() {
    setBusy(true);
    try {
      if (navigator.share) {
        const res = await fetch(pdfUrl);
        const file = new File([await res.blob()], filename, { type: "application/pdf" });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: filename, text });
          return;
        }
        await navigator.share({ title: filename, text });
        return;
      }
      setOpen((o) => !o);
    } catch (e) {
      // Partage annulé par l'utilisateur : rien à faire ; autre erreur : menu de secours.
      if (!(e instanceof DOMException && e.name === "AbortError")) setOpen(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex-1">
      <button type="button" onClick={share} disabled={busy} className="gph-btn-ghost w-full">
        <Share2 size={15} /> Partager
      </button>
      {open && (
        <div className="gph-card absolute bottom-12 left-0 z-10 flex w-56 flex-col p-1 text-left">
          <a className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold hover:bg-bg" target="_blank" rel="noopener noreferrer"
            href={`https://wa.me/${digits}?text=${enc}`}>
            <MessageCircle size={16} /> WhatsApp
          </a>
          <a className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold hover:bg-bg" href={`sms:${phone ?? ""}?body=${enc}`}>
            <MessageSquare size={16} /> SMS
          </a>
          <a className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold hover:bg-bg"
            href={`mailto:${email ?? ""}?subject=${encodeURIComponent(filename)}&body=${enc}`}>
            <Mail size={16} /> Email
          </a>
        </div>
      )}
    </div>
  );
}
