import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Cormorant_Garamond, Inter } from "next/font/google";
const display = Cormorant_Garamond({ subsets: ["latin"], weight: ["400", "500", "600", "700"], style: ["normal", "italic"], variable: "--font-cormorant" });
const sans = Inter({ subsets: ["latin"], variable: "--font-inter" });
export const metadata: Metadata = {
  title: { default: "GoBarber.ch — Barbier à domicile en Suisse", template: "%s — GoBarber.ch" },
  description: "Réservez un barbier qui se déplace chez vous : coupe, barbe, coupe enfant. Prix et frais affichés avant de payer.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3200"),
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#111113" };
export default function Root({ children }: { children: React.ReactNode }) {
  return <html lang="fr-CH" className={`${display.variable} ${sans.variable}`}><body>{children}</body></html>;
}
