// Config partagée du module Prospection (statuts, types de site, mapping legacy).
// Importable côté serveur et client (pas de directive).

import type { ProspectStage, ProspectStatus, WebsiteType } from "@/generated/prisma/enums"

// Chips aux pastels « Atelier » (portfolio pierrepocheron.fr) : lilas, menthe,
// beurre, pêche, rose — encre aubergine, bordures fines teintées.
export const STATUS_CONFIG: Record<ProspectStatus, { label: string; cls: string; dot: string }> = {
  TO_CONTACT:    { label: "À contacter",   cls: "bg-[#2A1B2E]/[0.06] text-[#6B5E6C] border-[#2A1B2E]/20 dark:bg-[#F5EDE3]/10 dark:text-[#C9BCC9] dark:border-[#F5EDE3]/20", dot: "bg-[#6B5E6C] dark:bg-[#A995A9]" },
  CONTACTED:     { label: "Contacté",      cls: "bg-[#D3B8DA]/40 text-[#6A2C5C] border-[#6A2C5C]/25 dark:bg-[#D3B8DA]/15 dark:text-[#D3B8DA] dark:border-[#D3B8DA]/30",     dot: "bg-[#C9A5D2]" },
  REPLIED:       { label: "A répondu",     cls: "bg-[#BFD9C4]/45 text-[#2F6B44] border-[#2F6B44]/25 dark:bg-[#BFD9C4]/15 dark:text-[#BFD9C4] dark:border-[#BFD9C4]/30",     dot: "bg-[#8FBF9B]" },
  IN_DISCUSSION: { label: "En discussion", cls: "bg-[#F4D670]/40 text-[#8A6A12] border-[#8A6A12]/25 dark:bg-[#F4D670]/15 dark:text-[#F4D670] dark:border-[#F4D670]/30",     dot: "bg-[#E9C64F]" },
  WON:           { label: "Gagné 🎉",      cls: "bg-[#E89D7C]/35 text-[#BE5634] border-[#BE5634]/30 dark:bg-[#E89D7C]/20 dark:text-[#F0B598] dark:border-[#E89D7C]/35",     dot: "bg-[#E89D7C]" },
  LOST:          { label: "Perdu",         cls: "bg-[#E8B5C3]/30 text-[#9A5B70] border-[#9A5B70]/25 dark:bg-[#E8B5C3]/[0.12] dark:text-[#D8A5B5] dark:border-[#E8B5C3]/25", dot: "bg-[#D898AC]" },
}

// Statuts "actifs" du pipeline (ordre de progression) — hors issues Gagné/Perdu.
export const PIPELINE_STATUSES: ProspectStatus[] = ["TO_CONTACT", "CONTACTED", "REPLIED", "IN_DISCUSSION"]
export const OUTCOME_STATUSES: ProspectStatus[] = ["WON", "LOST"]
export const ALL_STATUSES: ProspectStatus[] = [...PIPELINE_STATUSES, ...OUTCOME_STATUSES]

export const WEBSITE_TYPE_CONFIG: Record<WebsiteType, { label: string; cls: string }> = {
  SHOWCASE:     { label: "Vitrine",    cls: "bg-[#D3B8DA]/35 text-[#6A2C5C] dark:bg-[#D3B8DA]/15 dark:text-[#D3B8DA]" },
  ECOMMERCE:    { label: "E-commerce", cls: "bg-[#BFD9C4]/40 text-[#2F6B44] dark:bg-[#BFD9C4]/15 dark:text-[#BFD9C4]" },
  BLOG_CONTENT: { label: "Blog",       cls: "bg-[#F4D670]/35 text-[#8A6A12] dark:bg-[#F4D670]/15 dark:text-[#F4D670]" },
  OUTDATED:     { label: "Obsolète",   cls: "bg-[#E89D7C]/30 text-[#BE5634] dark:bg-[#E89D7C]/15 dark:text-[#F0B598]" },
  OTHER:        { label: "Autre",      cls: "bg-[#2A1B2E]/[0.06] text-[#6B5E6C] dark:bg-[#F5EDE3]/10 dark:text-[#C9BCC9]" },
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
