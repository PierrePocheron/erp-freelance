import "server-only"
import webpush from "web-push"
import { prisma } from "@/lib/prisma"

export type PushPayload = {
  title: string
  body?: string
  /** Route ouverte au tap sur la notification (défaut "/") */
  url?: string
}

let configured = false
function ensureConfigured(): boolean {
  if (configured) return true
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) return false
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:pierre@exemple.fr",
    publicKey,
    privateKey,
  )
  configured = true
  return true
}

/**
 * Envoie une notification push à tous les appareils abonnés de l'utilisateur.
 * Best-effort : un échec d'envoi ne casse jamais l'appelant, et les
 * abonnements morts (404/410 — app désinstallée, permission révoquée) sont
 * purgés au passage.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!ensureConfigured()) return

  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } })
  if (subscriptions.length === 0) return

  const body = JSON.stringify(payload)
  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body,
        )
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {})
        }
      }
    })
  )
}
