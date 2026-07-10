// Config partagée des catégories de projet (bannières, pills, groupement).
// Importable côté serveur et client (pas de directive).
//
// Chaque catégorie combine une COULEUR et un MOTIF distinct (rayures, points,
// croisillons…) façon Trello « colorblind friendly mode » : la forme seule
// suffit à différencier deux catégories, sans dépendre de la couleur.
// Réf. https://littlebigdetails.com/post/35775193711

import type { ProjectCategory } from "@/generated/prisma/enums"
import type { CSSProperties } from "react"

// Motifs en CSS pur (repeating-linear-gradient / radial-gradient) — pas
// d'asset externe, fonctionne en light/dark car dessinés en blanc translucide
// par-dessus la couleur pleine de la bannière.
const stripes45: CSSProperties = {
  backgroundImage: "repeating-linear-gradient(45deg, rgba(255,255,255,.28) 0 5px, transparent 5px 12px)",
}
const dots: CSSProperties = {
  backgroundImage: "radial-gradient(rgba(255,255,255,.38) 1.6px, transparent 1.6px)",
  backgroundSize: "9px 9px",
}
const crosshatch: CSSProperties = {
  backgroundImage:
    "repeating-linear-gradient(45deg, rgba(255,255,255,.22) 0 3px, transparent 3px 10px)," +
    "repeating-linear-gradient(-45deg, rgba(255,255,255,.22) 0 3px, transparent 3px 10px)",
}
const stripesH: CSSProperties = {
  backgroundImage: "repeating-linear-gradient(0deg, rgba(255,255,255,.26) 0 3px, transparent 3px 9px)",
}
const stripesV: CSSProperties = {
  backgroundImage: "repeating-linear-gradient(90deg, rgba(255,255,255,.26) 0 4px, transparent 4px 11px)",
}
const plain: CSSProperties = {}

export const CATEGORY_CONFIG: Record<ProjectCategory, {
  label: string
  /** Pill inline (édition, badges) — même palette que la bannière. */
  chipCls: string
  /** Couleur de fond de la bannière (classe Tailwind). */
  bannerCls: string
  /** Motif dessiné par-dessus la couleur (style inline). */
  pattern: CSSProperties
}> = {
  DEV:          { label: "Dev / Web",        chipCls: "text-indigo-600 border-indigo-500/30 bg-indigo-500/10",   bannerCls: "bg-indigo-500",  pattern: stripes45  },
  ETUDE:        { label: "Étude marketing",  chipCls: "text-violet-600 border-violet-500/30 bg-violet-500/10",   bannerCls: "bg-violet-500",  pattern: dots       },
  EVENEMENTIEL: { label: "Événementiel",     chipCls: "text-amber-600 border-amber-500/40 bg-amber-500/10",      bannerCls: "bg-amber-500",   pattern: crosshatch },
  FORMATION:    { label: "Formation",        chipCls: "text-teal-600 border-teal-500/30 bg-teal-500/10",         bannerCls: "bg-teal-500",    pattern: stripesH   },
  PROSPECTION:  { label: "Prospection",      chipCls: "text-sky-600 border-sky-500/30 bg-sky-500/10",            bannerCls: "bg-sky-500",     pattern: stripesV   },
  AUTRE:        { label: "Autre",            chipCls: "text-slate-500 border-slate-500/30 bg-slate-500/10",      bannerCls: "bg-slate-400",   pattern: plain      },
}

export const ALL_CATEGORIES = Object.keys(CATEGORY_CONFIG) as ProjectCategory[]
