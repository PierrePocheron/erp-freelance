// Logique pure de présentation d'un contact. Le champ `Client.name` stocké en
// base est un cache dénormalisé calculé par cette fonction à chaque écriture.

export type ContactNameParts = {
  label?: string | null
  firstName?: string | null
  lastName?: string | null
  companyName?: string | null
}

/**
 * Nom d'affichage d'un contact, par ordre de priorité :
 *  1. libellé manuel (`label`)
 *  2. « Prénom Nom » (l'un des deux peut manquer)
 *  3. nom de la société rattachée
 *  4. « Sans nom » en dernier recours (le champ étant non nullable en base)
 */
export function computeContactName({ label, firstName, lastName, companyName }: ContactNameParts): string {
  const trimmed = (s?: string | null) => (s ?? "").trim()

  const lbl = trimmed(label)
  if (lbl) return lbl

  const full = [trimmed(firstName), trimmed(lastName)].filter(Boolean).join(" ")
  if (full) return full

  const co = trimmed(companyName)
  if (co) return co

  return "Sans nom"
}

export type IncompleteContactFields = {
  firstName?: string | null
  lastName?:  string | null
  email?:     string | null
  phone?:     string | null
}

/**
 * Un contact est « à compléter » si son identité de référence (prénom + nom —
 * `Client.name` n'est qu'un cache d'affichage) ou ses coordonnées (email et
 * téléphone tous deux absents) manquent. Règle partagée par le graphe, la
 * fiche contact et la liste des contacts.
 */
export function isContactIncomplete(c: IncompleteContactFields): boolean {
  return !c.firstName || !c.lastName || (!c.email && !c.phone)
}
