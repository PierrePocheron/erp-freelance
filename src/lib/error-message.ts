// En production, Next remplace le message d'une erreur levée côté serveur par une phrase
// générique en anglais (« An error occurred in the Server Components render. The specific
// message is omitted in production builds… »). Afficher `e.message` tel quel montrait donc
// cet anglais à l'utilisateur : on retombe alors sur un libellé français explicite.
const MASKED_BY_NEXT = /Server Components render|omitted in production/i

export function errorMessage(e: unknown, fallback: string): string {
  const message = e instanceof Error ? e.message : ""
  return message && !MASKED_BY_NEXT.test(message) ? message : fallback
}
