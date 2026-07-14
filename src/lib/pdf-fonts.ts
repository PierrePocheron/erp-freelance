// Enregistrement des polices Poppins (licence OFL, fichiers dans public/fonts/)
// pour @react-pdf/renderer. Utilisé uniquement côté serveur (routes PDF, server
// actions, script de preview) — jamais importé par du code client.
//
// Si les TTF sont introuvables (bundle serverless incomplet, etc.), on retombe
// proprement sur Helvetica/Helvetica-Bold : le PDF reste généré, seul le style
// typographique est dégradé. Voir aussi outputFileTracingIncludes dans
// next.config.ts qui force l'inclusion de public/fonts/ dans les fonctions.

import fs from "fs"
import path from "path"
import { Font } from "@react-pdf/renderer"

const FONT_DIR = path.join(process.cwd(), "public", "fonts")

const FONT_FILES = [
  { file: "Poppins-Regular.ttf", fontWeight: 400 },
  { file: "Poppins-SemiBold.ttf", fontWeight: 600 },
  { file: "Poppins-ExtraBold.ttf", fontWeight: 800 },
] as const

let registered: boolean | null = null

// Enregistre Poppins une seule fois. Retourne true si la famille est utilisable.
export function registerPdfFonts(): boolean {
  if (registered !== null) return registered
  try {
    const fonts = FONT_FILES.map(({ file, fontWeight }) => ({
      src: path.join(FONT_DIR, file),
      fontWeight,
    }))
    if (!fonts.every((f) => fs.existsSync(f.src))) {
      registered = false
      return registered
    }
    Font.register({ family: "Poppins", fonts: [...fonts] })
    // Pas de césure automatique : les mots français coupés sans tiret sont
    // illisibles sur une facture.
    Font.registerHyphenationCallback((word) => [word])
    registered = true
  } catch {
    registered = false
  }
  return registered
}

// Styles typographiques utilisables dans les StyleSheet du template : Poppins
// avec graisse quand la famille est chargée, sinon Helvetica(-Bold).
export function pdfFont(weight: 400 | 600 | 800): {
  fontFamily: string
  fontWeight?: 400 | 600 | 800
} {
  if (registerPdfFonts()) return { fontFamily: "Poppins", fontWeight: weight }
  return { fontFamily: weight >= 600 ? "Helvetica-Bold" : "Helvetica" }
}

// ── Police du logo (« PP. ») — Barbra Semi Condensed ─────────────────────────
// Police commerciale (Nurrontype) — licence achetée par Pierre, versionnée sur
// sa décision explicite (14/07/2026). Sources par priorité :
//   1. PDF_LOGO_FONT_URL — override optionnel par URL
//   2. public/fonts/Barbra-Regular.ttf — fichier versionné (embarqué en prod
//      via outputFileTracingIncludes, cf. next.config.ts)
//   3. fallback : Poppins ExtraBold (logo correct, juste moins fidèle)
let logoRegistered: boolean | null = null

function registerLogoFont(): boolean {
  if (logoRegistered !== null) return logoRegistered
  try {
    const url = process.env.PDF_LOGO_FONT_URL
    const local = path.join(FONT_DIR, "Barbra-Regular.ttf")
    const src = url || (fs.existsSync(local) ? local : null)
    if (!src) {
      logoRegistered = false
      return logoRegistered
    }
    Font.register({ family: "Barbra", src })
    logoRegistered = true
  } catch {
    logoRegistered = false
  }
  return logoRegistered
}

/** Style du texte de logo : Barbra si disponible, sinon Poppins ExtraBold. */
export function pdfLogoFont(): { fontFamily: string; fontWeight?: 400 | 600 | 800 } {
  if (registerLogoFont()) return { fontFamily: "Barbra" }
  return pdfFont(800)
}
