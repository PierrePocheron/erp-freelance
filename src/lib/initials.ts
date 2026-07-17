// Module pur (pas de "server-only") — importable côté client et en test unit.

/**
 * Initiales de l'utilisateur (2 lettres max) — défaut du logo texte quand
 * aucun n'est configuré. « Pierre Pocheron » → « PP » ; un seul mot → ses
 * 2 premières lettres ; sans nom → 1re lettre de l'email.
 */
export function initialsOf(name: string | null, email: string | null): string {
  const clean = (name ?? "").trim()
  if (clean) {
    const words = clean.split(/\s+/).filter(Boolean)
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
    return words[0].slice(0, 2).toUpperCase()
  }
  return (email?.[0] ?? "•").toUpperCase()
}
