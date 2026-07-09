// Config partagée du module Prospection (statuts, types de site, mapping legacy).
// Importable côté serveur et client (pas de directive).

import type { ProspectStage, ProspectStatus, WebsiteType } from "@/generated/prisma/enums"

export const STATUS_CONFIG: Record<ProspectStatus, { label: string; cls: string; dot: string }> = {
  TO_CONTACT:    { label: "À contacter",   cls: "bg-slate-500/15 text-slate-600 border-slate-500/20 dark:text-slate-400", dot: "bg-slate-400"   },
  CONTACTED:     { label: "Contacté",      cls: "bg-blue-500/15 text-blue-600 border-blue-500/20",                        dot: "bg-blue-400"    },
  REPLIED:       { label: "A répondu",     cls: "bg-teal-500/15 text-teal-600 border-teal-500/20",                        dot: "bg-teal-400"    },
  IN_DISCUSSION: { label: "En discussion", cls: "bg-violet-500/15 text-violet-600 border-violet-500/20",                  dot: "bg-violet-400"  },
  WON:           { label: "Gagné 🎉",      cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/20",               dot: "bg-emerald-500" },
  LOST:          { label: "Perdu",         cls: "bg-red-500/15 text-red-600 border-red-500/20",                           dot: "bg-red-400"     },
}

// Statuts "actifs" du pipeline (ordre de progression) — hors issues Gagné/Perdu.
export const PIPELINE_STATUSES: ProspectStatus[] = ["TO_CONTACT", "CONTACTED", "REPLIED", "IN_DISCUSSION"]
export const OUTCOME_STATUSES: ProspectStatus[] = ["WON", "LOST"]
export const ALL_STATUSES: ProspectStatus[] = [...PIPELINE_STATUSES, ...OUTCOME_STATUSES]

export const WEBSITE_TYPE_CONFIG: Record<WebsiteType, { label: string; cls: string }> = {
  SHOWCASE:     { label: "Vitrine",    cls: "bg-blue-500/15 text-blue-600"     },
  ECOMMERCE:    { label: "E-commerce", cls: "bg-emerald-500/15 text-emerald-600" },
  BLOG_CONTENT: { label: "Blog",       cls: "bg-amber-500/15 text-amber-700"   },
  OUTDATED:     { label: "Obsolète",   cls: "bg-red-500/15 text-red-600"       },
  OTHER:        { label: "Autre",      cls: "bg-muted text-muted-foreground"   },
}

export const SOURCE_LABELS: Record<string, string> = {
  WORD_OF_MOUTH: "Bouche à oreille",
  LINKEDIN: "LinkedIn",
  WEBSITE: "Site web",
  INBOUND: "Entrant",
  OTHER: "Autre",
}

// Mapping de l'ancien pipeline 10 étapes vers le statut 6 valeurs — miroir
// exact du backfill SQL de la migration 20260709175541 (testé unitairement).
export const LEGACY_STAGE_TO_STATUS: Record<ProspectStage, ProspectStatus> = {
  IDENTIFIED:    "TO_CONTACT",
  CONTACTED:     "CONTACTED",
  NO_RESPONSE:   "CONTACTED",
  REPLIED:       "REPLIED",
  MEETING:       "IN_DISCUSSION",
  PROPOSAL_SENT: "IN_DISCUSSION",
  NEGOTIATION:   "IN_DISCUSSION",
  WON:           "WON",
  LOST:          "LOST",
  ON_HOLD:       "LOST",
}
