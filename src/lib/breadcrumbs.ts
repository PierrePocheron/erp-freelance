import type { ElementType } from "react"

/**
 * Fil d'Ariane dérivé de l'URL. Le module de tête (icône + libellé) vient de
 * `navItems`. Les sous-routes STATIQUES sont nommées ici (clé = motif de chemin,
 * `[id]` pour un segment dynamique). Les segments dynamiques (ids d'entités)
 * prennent leur libellé du contexte, alimenté par la page/layout de détail
 * (ex. nom du contact) — sinon « Détail » par défaut.
 */

export type Crumb = { label: string; href: string; icon?: ElementType }

export type BreadcrumbModule = { href: string; label: string; icon: ElementType }

// Sous-routes statiques : motif de chemin → libellé lisible.
export const SUBROUTE_LABELS: Record<string, string> = {
  // Contacts
  "/contacts/prospects": "Prospects",
  "/contacts/[id]/interactions": "Interactions",
  "/contacts/[id]/projets": "Projets",
  "/contacts/[id]/rappels": "Rappels",
  // Prospection
  "/prospection/mode": "Session de prospection",
  "/prospection/brouillons": "Brouillons",
  "/prospection/modeles": "Modèles de mails",
  "/prospection/appels": "Modèles d'appel",
  // Facturation
  "/facturation/devis": "Devis",
  "/facturation/factures": "Factures",
  "/facturation/produits": "Produits",
  "/facturation/recurrentes": "Récurrentes",
  // Revenus
  "/revenus/recapitulatif": "Récapitulatif",
  "/revenus/sources": "Sources",
  // Projets
  "/projets/[id]/dev": "Développement",
  "/projets/[id]/post-dev": "Post-dev",
  "/projets/[id]/temps": "Temps",
  // Entretiens
  "/entretiens/faq": "FAQ",
}

function prettify(seg: string): string {
  return seg.charAt(0).toUpperCase() + seg.slice(1)
}

/**
 * Construit le fil d'Ariane pour un chemin donné.
 * @param pathname   chemin courant (usePathname)
 * @param modules    registre des modules de tête (navItems)
 * @param dynLabels  libellés des segments dynamiques (valeur d'id → libellé), du contexte
 */
export function buildCrumbs(
  pathname: string,
  modules: BreadcrumbModule[],
  dynLabels: Record<string, string>,
): Crumb[] {
  const segments = pathname.split("/").filter(Boolean)

  // Accueil
  if (segments.length === 0) {
    const home = modules.find((m) => m.href === "/")
    return home ? [{ label: home.label, href: "/", icon: home.icon }] : []
  }

  const moduleHref = "/" + segments[0]
  const mod = modules.find((m) => m.href === moduleHref)
  const crumbs: Crumb[] = [
    mod
      ? { label: mod.label, href: mod.href, icon: mod.icon }
      : { label: prettify(segments[0]), href: moduleHref },
  ]

  // `pattern` accumule le MOTIF (avec [id] pour les segments dynamiques),
  // `href` accumule le chemin RÉEL (avec les vrais ids) pour les liens.
  let pattern = moduleHref
  let href = moduleHref
  for (let i = 1; i < segments.length; i++) {
    const seg = segments[i]
    href += "/" + seg
    const staticPattern = pattern + "/" + seg
    if (SUBROUTE_LABELS[staticPattern] !== undefined) {
      crumbs.push({ label: SUBROUTE_LABELS[staticPattern], href })
      pattern = staticPattern
    } else {
      // Segment dynamique : libellé du contexte, sinon un libellé de motif, sinon « Détail »
      const dynPattern = pattern + "/[id]"
      crumbs.push({ label: dynLabels[seg] ?? SUBROUTE_LABELS[dynPattern] ?? "Détail", href })
      pattern = dynPattern
    }
  }

  return crumbs
}
