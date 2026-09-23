// Avatar à initiales, couleur dérivée du nom (design : components.jsx).
const PALETTE: [string, string][] = [
  ["#1B5E20", "#4CAF50"],
  ["#0F766E", "#14B8A6"],
  ["#7C3AED", "#A78BFA"],
  ["#DB2777", "#F472B6"],
  ["#D97706", "#F59E0B"],
  ["#2563EB", "#60A5FA"],
  ["#9333EA", "#C084FC"],
  ["#0891B2", "#22D3EE"],
];

export function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function nameColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function Avatar({ name, size = 40, photoUrl }: { name: string; size?: number; photoUrl?: string | null }) {
  const [c1, c2] = nameColor(name);
  return (
    <div
      aria-hidden
      className="inline-flex flex-none items-center justify-center overflow-hidden rounded-full font-semibold text-white"
      style={{ width: size, height: size, fontSize: size * 0.36, background: `linear-gradient(135deg, ${c1}, ${c2})` }}
    >
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        initials(name)
      )}
    </div>
  );
}
