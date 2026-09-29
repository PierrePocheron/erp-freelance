import { cookies } from "next/headers"
import { unstable_rethrow } from "next/navigation"

/**
 * Message « flash » pour les formulaires à action serveur des pages serveur.
 *
 * En production, Next remplace le message d'une erreur levée côté serveur par une phrase
 * générique en anglais (« An error occurred in the Server Components render… ») : le
 * message métier (« Le client n'a pas d'adresse email »…) n'arrivait jamais, et la page
 * entière basculait sur error.tsx. Ici l'erreur est interceptée CÔTÉ SERVEUR (où le message
 * est intact), posée dans un cookie court, puis affichée en toast par <FlashToast /> au
 * re-rendu qui suit l'action (modifier un cookie dans une action re-rend la route).
 */
export type Flash = { kind: "success" | "error"; message: string; id: number }

export const FLASH_COOKIE = "flash"

export async function setFlash(kind: Flash["kind"], message: string) {
  const store = await cookies()
  store.set(FLASH_COOKIE, JSON.stringify({ kind, message, id: Date.now() } satisfies Flash), {
    path: "/", maxAge: 60, sameSite: "lax",
  })
}

/** Exécute l'action ; succès → toast optionnel, erreur → toast du message métier. */
export async function runWithFlash(fn: () => Promise<unknown>, success?: string) {
  try {
    await fn()
  } catch (e) {
    unstable_rethrow(e) // redirect()/notFound() de Next passent tels quels
    await setFlash("error", e instanceof Error && e.message ? e.message : "Une erreur est survenue")
    return
  }
  if (success) await setFlash("success", success)
}

export async function readFlash(): Promise<Flash | null> {
  const raw = (await cookies()).get(FLASH_COOKIE)?.value
  if (!raw) return null
  try {
    const f = JSON.parse(raw) as Flash
    return f && typeof f.message === "string" ? f : null
  } catch {
    return null
  }
}
