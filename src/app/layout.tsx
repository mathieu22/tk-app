import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { ServiceWorkerRegister } from "@/components/sw-register";
import { themeCss } from "@/lib/theme";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"] });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Gestion TKDChoc", template: "%s · TKDChoc" },
  description: "Présences, membres et cotisations du club de taekwondo",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "TKDChoc", statusBarStyle: "default" },
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
      {/* Toujours un unique <style>, jamais un enfant conditionnel (booléen/chaîne) : une expression
          qui alterne entre "" et un élément produirait un nœud de texte invalide dans <head>
          et un décalage d'hydratation. */}
      <head><style dangerouslySetInnerHTML={{ __html: theme.css }} /></head>
      <body className="min-h-full">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
