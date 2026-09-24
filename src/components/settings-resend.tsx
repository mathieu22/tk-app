"use client";
import { RefreshCw } from "lucide-react";
import { useTransition } from "react";
import { resendMessage } from "@/app/actions/settings";

export function SettingsResendButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button className="gph-btn-ghost min-h-0 py-1.5 text-xs" disabled={pending} onClick={() => start(() => resendMessage(id))}>
      <RefreshCw size={13} /> Renvoyer
    </button>
  );
}
