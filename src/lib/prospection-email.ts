/**
 * From utilisable pour les mails de prospection : RESEND_FROM_EMAIL, mais
 * jamais le sandbox resend.dev (limité à sa propre adresse, et désastreux en
 * délivrabilité pour du cold email). Null = fonctionnalité non configurée —
 * l'UI affiche un bandeau expliquant le prérequis (domaine vérifié chez Resend).
 */
export function prospectionFromAddress(): string | null {
  const from = process.env.RESEND_FROM_EMAIL
  if (!from || from.includes("resend.dev")) return null
  return from
}
