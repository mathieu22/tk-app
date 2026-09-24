"use client";
// Sélecteur d'enfant (US-7.2) — met à jour ?enfant= en conservant la page courante.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar } from "./avatar";

export function EspaceChildPicker({ items, selectedId }: {
  items: { id: string; name: string; photoUrl: string | null }[]; selectedId: string | null;
}) {
  const path = usePathname();
  if (items.length < 2) return null;
  return (
    <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-3">
      {items.map((c) => {
        const active = c.id === selectedId;
        return (
          <Link key={c.id} href={`${path}?enfant=${c.id}`} replace scroll={false}
            className={`flex flex-none items-center gap-2 rounded-full border py-1 pl-1 pr-3.5 text-[13px] font-semibold ${active ? "border-primary bg-primary text-white" : "border-divider bg-card text-ink-2"}`}>
            <Avatar name={c.name} size={30} photoUrl={c.photoUrl} />
            {c.name.split(" ")[0]}
          </Link>
        );
      })}
    </div>
  );
}
