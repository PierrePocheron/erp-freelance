/**
 * Liste blanche des comptes autorisés à se connecter — `AUTH_ALLOWED_EMAILS`
 * (emails séparés par des virgules, espaces ou points-virgules).
 *
 * L'app est déployée publiquement sur Vercel : sans cette porte, n'importe quel
 * compte Google pouvait se connecter et obtenir son propre espace de travail.
 *
 * Module PUR (ni prisma ni "server-only") : il tourne aussi dans le runtime edge
 * du proxy, où le client Prisma n'existe pas.
 */
export function parseAllowlist(raw: string | undefined | null): string[] {
  return (raw ?? "")
    .split(/[,;\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

export function hasAllowlist(raw: string | undefined | null): boolean {
  return parseAllowlist(raw).length > 0
}

/**
 * ⚠️ Renvoie `true` quand la liste n'est PAS configurée (variable absente) : la
 * porte stricte est alors assurée par le callback `signIn` de `lib/auth.ts`, qui
 * n'autorise que les comptes déjà présents en base. Sans ça, une variable oubliée
 * en prod verrouillerait aussi le propriétaire, hors de toute session.
 */
export function isEmailAllowed(email: string | null | undefined, raw: string | undefined | null): boolean {
  const list = parseAllowlist(raw)
  if (list.length === 0) return true
  const clean = email?.trim().toLowerCase()
  return !!clean && list.includes(clean)
}
