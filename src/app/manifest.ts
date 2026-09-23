import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GPH — Gestion de Présence",
    short_name: "GPH",
    description: "Présences, membres et cotisations du club de taekwondo",
    start_url: "/presence",
    display: "standalone",
    background_color: "#F5F7FA",
    theme_color: "#1B5E20",
    lang: "fr",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
