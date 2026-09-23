import { ShieldX } from "lucide-react";
import Link from "next/link";

export default function Forbidden() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <ShieldX size={40} className="text-danger" />
      <h1 className="text-xl font-bold">Accès refusé</h1>
      <p className="text-sm text-ink-2">Votre profil ne permet pas d&apos;accéder à cette page.</p>
      <Link href="/presence" className="gph-btn-primary mt-2">Retour à l&apos;accueil</Link>
    </div>
  );
}
