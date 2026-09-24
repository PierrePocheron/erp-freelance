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

// Pastille d'initiales d'un contact (aucune photo en base) : couleur déterministe
// depuis le nom, pour qu'une même personne garde la même couleur partout dans l'app.
export const AVATAR_COLORS = ["#6366f1", "#8b5cf6", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#14b8a6", "#f97316", "#64748b"]

export function avatarColor(name: string): string {
  let h = 0
  for (const ch of name.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) | 0
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const s = parts.length >= 2 ? parts[0][0] + parts[1][0] : name.trim().slice(0, 2)
  return s.toUpperCase() || "?"
}
