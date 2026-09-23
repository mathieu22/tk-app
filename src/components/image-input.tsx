"use client";
// Photo / justificatif : appareil photo ou galerie, recadrage carré optionnel et compression côté client.
// La valeur est une data URL JPEG (~20-80 Ko) stockée en base : portable (SQLite, Postgres, Vercel).
import { Camera, X } from "lucide-react";
import { useRef, useState } from "react";

export async function compressImage(file: File, maxSize = 512, square = false, quality = 0.8): Promise<string> {
  const bitmap = await createImageBitmap(file);
  let sx = 0, sy = 0, sw = bitmap.width, sh = bitmap.height;
  if (square) {
    const side = Math.min(sw, sh);
    sx = (sw - side) / 2;
    sy = (sh - side) / 2;
    sw = sh = side;
  }
  const scale = Math.min(1, maxSize / Math.max(sw, sh));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(sw * scale);
  canvas.height = Math.round(sh * scale);
  canvas.getContext("2d")!.drawImage(bitmap, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}

/** Champ caché `name` contenant la data URL ; "" pour supprimer. */
export function ImageInput({ name, defaultValue, square = false, maxSize = 512, label = "Ajouter une photo", round = false }: {
  name: string; defaultValue?: string | null; square?: boolean; maxSize?: number; label?: string; round?: boolean;
}) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col items-center gap-2">
      <input type="hidden" name={name} value={value} />
      <input ref={input} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          try {
            setError(null);
            setValue(await compressImage(f, maxSize, square));
          } catch {
            setError("Image illisible.");
          }
        }} />
      <button type="button" onClick={() => input.current?.click()}
        className={`relative flex h-[84px] w-[84px] items-center justify-center overflow-hidden border-2 border-dashed border-primary bg-primary-soft ${round ? "rounded-full" : "rounded-2xl"}`}>
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="h-full w-full object-cover" />
        ) : (
          <Camera size={30} className="text-primary" strokeWidth={1.6} />
        )}
      </button>
      <div className="flex items-center gap-3 text-xs font-semibold text-primary">
        <button type="button" onClick={() => input.current?.click()}>{value ? "Changer" : label}</button>
        {value && (
          <button type="button" onClick={() => setValue("")} className="flex items-center gap-1 text-danger">
            <X size={12} /> Retirer
          </button>
        )}
      </div>
      {error && <p className="text-xs font-semibold text-danger">{error}</p>}
    </div>
  );
}
