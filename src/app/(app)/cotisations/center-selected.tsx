"use client";
// Fait défiler le carrousel horizontal pour afficher l'élément sélectionné (mois en cours).
import { useEffect, useRef, type ReactNode } from "react";

export function CenterSelected({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector("[data-selected]")?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [children]);
  return <div ref={ref} className={className}>{children}</div>;
}
