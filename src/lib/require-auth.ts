import "server-only"
import { auth } from "@/lib/auth"
import { isEmailAllowed } from "@/lib/auth-allowlist"

/**
 * Identifiant de l'appelant, dérivé de la SESSION — jamais d'un argument :
 * chaque export d'un fichier `"use server"` est un endpoint HTTP public, et un
 * `userId` passé en paramètre est donc choisi par l'appelant.
 *
 * Contrôle aussi la liste blanche (`AUTH_ALLOWED_EMAILS`). Le proxy edge la
 * revalide à chaque requête, mais son matcher saute les chemins contenant un
 * point (convention pour ne pas intercepter les fichiers statiques) : une action
 * POSTée sur un tel chemin ne passait pas par lui, et un jeton déjà émis gardait
 * donc l'écriture pendant toute sa durée de vie après retrait de la liste. Ici,
 * le contrôle est sur le chemin de TOUTES les actions.
 */
export async function requireAuth(): Promise<string> {
  const session = await auth()
  const id = session?.user?.id
  if (!id) throw new Error("Non autorisé")
  if (!isEmailAllowed(session.user.email, process.env.AUTH_ALLOWED_EMAILS)) {
    throw new Error("Non autorisé")
  }
  return id
}
