"use server"

import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { sendPushToUser } from "@/lib/push"

async function requireAuth(): Promise<string> {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Non autorisé")
  return session.user.id
}

/** Enregistre (ou ré-attribue) l'abonnement push de l'appareil courant. */
export async function savePushSubscription(sub: {
  endpoint: string
  keys: { p256dh: string; auth: string }
}) {
  const userId = await requireAuth()
  // upsert par endpoint : si l'appareil se réabonne, on met à jour les clés
  await prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    create: { userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    update: { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
  })
}

/** Supprime l'abonnement de l'appareil courant (désactivation). */
export async function removePushSubscription(endpoint: string) {
  const userId = await requireAuth()
  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId } })
}

/** Notification de test — permet de vérifier la chaîne de bout en bout. */
export async function sendTestPush() {
  const userId = await requireAuth()
  await sendPushToUser(userId, {
    title: "ERP Freelance",
    body: "Les notifications sont activées sur cet appareil ✓",
    url: "/",
  })
}
