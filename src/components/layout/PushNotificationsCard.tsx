"use client"

import { useEffect, useState } from "react"
import { Bell } from "lucide-react"
import { toast } from "sonner"
import { savePushSubscription, sendTestPush } from "@/actions/push"

// Clé publique VAPID → format attendu par pushManager.subscribe.
// `new Uint8Array(n)` (adossé à un ArrayBuffer) plutôt que Uint8Array.from :
// TS 5.7 type ce dernier en Uint8Array<ArrayBufferLike>, refusé par BufferSource.
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = atob(b64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

async function subscribeDevice(): Promise<void> {
  const registration = await navigator.serviceWorker.register("/sw.js")
  await navigator.serviceWorker.ready
  const existing = await registration.pushManager.getSubscription()
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
    }))
  const json = subscription.toJSON()
  await savePushSubscription({
    endpoint: subscription.endpoint,
    keys: { p256dh: json.keys!.p256dh, auth: json.keys!.auth },
  })
}

/**
 * Notifications push de la PWA.
 * - Permission jamais demandée → carte « Activer les notifications » ; la
 *   demande DOIT partir d'un geste utilisateur (exigence iOS/Chrome).
 * - Permission déjà accordée → ré-abonnement silencieux au montage (garde
 *   l'appareil abonné même si le navigateur a fait tourner l'endpoint).
 * - Non supporté (Safari iOS hors PWA installée, permission refusée) → rien.
 */
export function PushNotificationsCard() {
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const supported =
      "serviceWorker" in navigator && "PushManager" in window && "Notification" in window
    if (!supported) return

    if (Notification.permission === "granted") {
      // Déjà autorisé → on maintient l'abonnement, sans UI
      subscribeDevice().catch(() => {})
      return
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (Notification.permission === "default") setShow(true)
  }, [])

  async function enable() {
    setBusy(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== "granted") {
        toast.info("Notifications refusées — activables plus tard dans les réglages du navigateur")
        setShow(false)
        return
      }
      await subscribeDevice()
      await sendTestPush()
      toast.success("Notifications activées ✓")
      setShow(false)
    } catch {
      toast.error("Impossible d'activer les notifications")
    } finally {
      setBusy(false)
    }
  }

  if (!show) return null

  return (
    <button
      type="button"
      onClick={enable}
      disabled={busy}
      className="flex w-full items-center gap-3 rounded-xl border border-border/50 bg-card px-4 py-3 text-left transition-colors active:bg-accent disabled:opacity-60"
    >
      <Bell className="h-4 w-4 shrink-0 text-primary" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">Activer les notifications</span>
        <span className="block text-xs text-muted-foreground">
          Rappels et alertes directement sur cet appareil
        </span>
      </span>
      <span className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">
        {busy ? "…" : "Activer"}
      </span>
    </button>
  )
}
