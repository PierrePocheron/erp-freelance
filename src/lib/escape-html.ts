/**
 * Échappe les caractères spéciaux HTML pour neutraliser toute injection lors de
 * l'interpolation de valeurs (noms de contacts, etc.) dans des templates email.
 */
export function escapeHtml(value: string | null | undefined): string {
  if (!value) return ""
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
