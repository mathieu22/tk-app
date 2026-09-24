// Badge de ceinture dessiné comme les tableaux du club (US-4.1) :
// bande de la couleur principale, 0 à 2 barrettes à l'extrémité droite.

export const BELT_COLORS: Record<string, { label: string; hex: string }> = {
  white: { label: "Blanc", hex: "#F4F4F5" },
  yellow: { label: "Jaune", hex: "#FACC15" },
  orange: { label: "Orange", hex: "#F97316" },
  green: { label: "Vert", hex: "#16A34A" },
  purple: { label: "Violet", hex: "#7C3AED" },
  blue: { label: "Bleu", hex: "#2563EB" },
  red: { label: "Rouge", hex: "#DC2626" },
  brown: { label: "Marron", hex: "#92400E" },
  black: { label: "Noir", hex: "#111827" },
};

/** Couleur nommée (white, blue…) ou hexadécimale. */
export function beltHex(color: string | null | undefined) {
  if (!color) return BELT_COLORS.white.hex;
  if (/^#[0-9a-fA-F]{3,8}$/.test(color)) return color;
  return BELT_COLORS[color]?.hex ?? BELT_COLORS.white.hex;
}

export type BeltLike = { mainColor: string; stripeColor?: string | null; stripeCount?: number | null; kind?: string };

/** Poom = ceinture rouge et noire (moitié haute rouge, moitié basse noire). */
export function BeltBadge({ grade, width = 64, height = 16, title }: { grade: BeltLike; width?: number; height?: number; title?: string }) {
  const main = beltHex(grade.mainColor);
  const stripe = beltHex(grade.stripeColor ?? "black");
  const n = Math.max(0, Math.min(2, grade.stripeCount ?? 0));
  const sw = Math.max(3, Math.round(width * 0.07));
  const gap = Math.max(2, Math.round(width * 0.05));
  const isPoom = grade.kind === "POOM";
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title} className="flex-none">
      {title && <title>{title}</title>}
      <rect x={0.5} y={0.5} width={width - 1} height={height - 1} rx={3} fill={main} stroke="rgba(0,0,0,0.18)" />
      {isPoom && <rect x={1} y={height / 2} width={width - 2} height={height / 2 - 1} rx={2} fill={BELT_COLORS.black.hex} />}
      {Array.from({ length: n }, (_, i) => (
        <rect key={i} x={width - gap - sw - i * (sw + gap)} y={1} width={sw} height={height - 2} fill={stripe} />
      ))}
    </svg>
  );
}

/** Badge + libellé (« Bleue 1 barrette rouge · 5e keup »). */
export function BeltLabel({ grade, sub }: { grade: BeltLike & { beltLabel: string }; sub?: string }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <BeltBadge grade={grade} title={grade.beltLabel} />
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold">{grade.beltLabel}</span>
        {sub && <span className="block text-xs font-medium text-ink-3">{sub}</span>}
      </span>
    </span>
  );
}
