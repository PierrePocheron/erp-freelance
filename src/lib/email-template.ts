/**
 * Rendu des modèles de mails de démarchage : substitution de variables
 * {{prenom}}, {{societe}}, {{site}}... par les champs du prospect.
 * Fonctions pures, unit-testées.
 */

import { escapeHtml } from "@/lib/escape-html"

export type TemplateProspect = {
  name: string
  firstName?: string | null
  lastName?: string | null
  company?: string | null
  websiteUrl?: string | null
  city?: string | null
  region?: string | null
  businessDescription?: string | null
  // Enrichissement prospect-finder (audit du site)
  cms?: string | null
  seoScore?: number | null
  performanceScore?: number | null
  seoIssues?: string | null
  publicationManager?: string | null
  domainCreatedAt?: Date | string | null
}

// Variables disponibles dans les modèles (documentées dans l'UI).
export const TEMPLATE_VARIABLES: { key: string; label: string }[] = [
  { key: "prenom",       label: "Prénom" },
  { key: "nom",          label: "Nom de famille" },
  { key: "nom_complet",  label: "Nom complet" },
  { key: "societe",      label: "Société" },
  { key: "site",         label: "URL du site" },
  { key: "ville",        label: "Ville" },
  { key: "region",       label: "Région" },
  { key: "description",  label: "Description du business" },
  { key: "cms",          label: "CMS / prestataire du site (ex. local.fr)" },
  { key: "score_seo",    label: "Score SEO (0-100)" },
  { key: "problemes_seo", label: "Problèmes SEO détectés (liste)" },
  { key: "responsable",  label: "Responsable de publication" },
  { key: "age_site",     label: "Âge du site (ex. « 3 ans »)" },
]

/** « 2021-06-11 » → « 4 ans » (arrondi à l'année, « moins d'un an » sinon). */
function siteAge(createdAt: Date | string | null | undefined): string | null {
  if (!createdAt) return null
  const t = new Date(createdAt).getTime()
  if (Number.isNaN(t)) return null
  const years = Math.floor((Date.now() - t) / (365.25 * 24 * 3600 * 1000))
  return years >= 1 ? `${years} an${years > 1 ? "s" : ""}` : "moins d'un an"
}

function fieldValue(prospect: TemplateProspect, key: string): string | null {
  switch (key) {
    case "prenom":        return prospect.firstName ?? null
    case "nom":           return prospect.lastName ?? null
    case "nom_complet":   return prospect.name || null
    case "societe":       return prospect.company ?? null
    case "site":          return prospect.websiteUrl ?? null
    case "ville":         return prospect.city ?? null
    case "region":        return prospect.region ?? null
    case "description":   return prospect.businessDescription ?? null
    case "cms":           return prospect.cms ?? null
    case "score_seo":     return prospect.seoScore != null ? String(prospect.seoScore) : null
    case "problemes_seo": return prospect.seoIssues?.trim() || null
    case "responsable":   return prospect.publicationManager ?? null
    case "age_site":      return siteAge(prospect.domainCreatedAt)
    default:              return null
  }
}

export type RenderedTemplate = {
  subject: string
  body: string
  /** Variables référencées dans le modèle mais vides/inconnues pour ce prospect. */
  missing: string[]
}

const VAR_RE = /\{\{\s*(\w+)\s*\}\}/g

/** Substitue les variables d'un modèle pour un prospect donné (texte brut). */
export function renderTemplate(
  template: { subject: string; body: string },
  prospect: TemplateProspect
): RenderedTemplate {
  const missing = new Set<string>()

  const substitute = (text: string) =>
    text.replace(VAR_RE, (_, key: string) => {
      const value = fieldValue(prospect, key)
      if (!value?.trim()) {
        missing.add(key)
        return ""
      }
      return value.trim()
    })

  return {
    subject: substitute(template.subject),
    body: substitute(template.body),
    missing: [...missing],
  }
}

/** Convertit un corps texte rendu en HTML simple (paragraphes), valeurs échappées. */
export function bodyToHtml(body: string): string {
  return body
    .split(/\n{2,}/)
    .map((para) => `<p>${escapeHtml(para).replace(/\n/g, "<br />")}</p>`)
    .join("\n")
}
