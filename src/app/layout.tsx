import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { ServiceWorkerRegister } from "@/components/sw-register";
import { themeCss } from "@/lib/theme";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"] });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "GPH — Gestion de Présence", template: "%s · GPH" },
  description: "Présences, membres et cotisations du club de taekwondo",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "GPH", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#1B5E20",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const theme = await themeCss();
  return (
    <html lang="fr" className={`${jakarta.variable} ${jetbrains.variable} h-full`} data-theme={theme.dark ? "dark" : undefined}>
      <head>{theme.css && <style>{theme.css}</style>}</head>
      <body className="min-h-full">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
