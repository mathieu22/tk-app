"use client";
import { useRouter } from "next/navigation";

/**
 * Sélecteur de saison : navigation par lien (fonctionne sans JS via un select natif + redirection).
 * `otherParams` (déjà calculé côté serveur, valeurs simples) évite de passer une fonction
 * en prop à un composant client depuis un Server Component.
 */
export function SeasonSelect({ seasons, value, basePath, otherParams = {} }: {
  seasons: { id: string; year: number }[]; value: string; basePath: string; otherParams?: Record<string, string>;
}) {
  const router = useRouter();
  const hrefFor = (id: string) => {
    const u = new URLSearchParams({ ...otherParams, ...(id && { saison: id }) });
    return `${basePath}${u.size ? `?${u}` : ""}`;
  };
  return (
    <select
      defaultValue={value}
      className="gph-input w-auto py-2 text-[13px]"
      onChange={(e) => router.push(hrefFor(e.target.value))}
    >
      <option value="">Toutes saisons</option>
      {seasons.map((s) => <option key={s.id} value={s.id}>{s.year}</option>)}
    </select>
  );
}
