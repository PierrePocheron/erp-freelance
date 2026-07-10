import { Resend } from "resend"

let client: Resend | null = null

/**
 * Client Resend paresseux : instancié au premier envoi réel plutôt qu'au
 * chargement du module — le constructeur exige RESEND_API_KEY, absente des
 * environnements qui n'envoient jamais (tests d'intégration notamment).
 */
export function getResend(): Resend {
  if (!client) client = new Resend(process.env.RESEND_API_KEY)
  return client
}
