// Polices du thème « Atelier » (DA du portfolio pierrepocheron.fr), chargées
// uniquement par les pages du module Prospection via leurs variables CSS.
import { Bricolage_Grotesque, DM_Mono } from "next/font/google"

export const atelierSans = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-atelier",
  display: "swap",
})

export const atelierMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-atelier-mono",
  display: "swap",
})
