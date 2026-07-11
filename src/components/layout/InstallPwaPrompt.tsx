"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { Share, SquarePlus, X, Download } from "lucide-react"

const DISMISS_KEY = "erp-pwa-install-dismissed"
const DISMISS_DAYS = 14

// Événement Chromium non typé par TS
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

/**
 * Bandeau mobile proposant d'installer la PWA, affiché à la connexion si
 * l'app ne tourne pas déjà en standalone. Deux comportements :
 * - Android/Chrome : capture `beforeinstallprompt` → bouton « Installer »
 *   qui déclenche la vraie invite native.
 * - iOS : aucune API d'installation n'existe → mini-guide
 *   « Partager → Sur l'écran d'accueil ».
 * Fermé → silencieux pendant 14 jours (localStorage).
 */
export function InstallPwaPrompt() {
  const [visible, setVisible] = useState(false)
  const [platform, setPlatform] = useState<"ios" | "android" | null>(null)
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    // Déjà installée (standalone) → rien à proposer
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // Safari iOS expose navigator.standalone
      (navigator as unknown as { standalone?: boolean }).standalone === true
    if (standalone) return

    // Fermé récemment → on ne re-propose pas avant DISMISS_DAYS
    const dismissed = Number(localStorage.getItem(DISMISS_KEY) ?? 0)
    if (Date.now() - dismissed < DISMISS_DAYS * 24 * 60 * 60 * 1000) return

    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)

    if (isIOS) {
      // iOS : pas d'API — bandeau pédagogique, après un court délai pour ne
      // pas sauter au visage à l'arrivée
      const t = setTimeout(() => {
        setPlatform("ios")
        setVisible(true)
      }, 2500)
      return () => clearTimeout(t)
    }

    // Android/Chrome : le navigateur émet beforeinstallprompt quand l'app est
    // installable — on le capture pour le rejouer depuis notre bouton
    function onBeforeInstall(e: Event) {
      e.preventDefault()
      setInstallEvent(e as BeforeInstallPromptEvent)
      setPlatform("android")
      setVisible(true)
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall)
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall)
  }, [])

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setVisible(false)
  }

  async function install() {
    if (!installEvent) return
    await installEvent.prompt()
    const { outcome } = await installEvent.userChoice
    if (outcome === "accepted") setVisible(false)
    else dismiss()
  }

  if (!visible) return null

  return (
    <div className="sm:hidden fixed inset-x-3 bottom-4 z-[60] rounded-2xl border border-border bg-card p-4 shadow-2xl">
      <div className="flex items-start gap-3">
        {/* Icône de l'app */}
        <Image src="/icons/icon-192.png" alt="" width={40} height={40} className="rounded-xl shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Installer ERP Freelance</p>
          {platform === "ios" ? (
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Ajoute l&apos;app à ton écran d&apos;accueil :{" "}
              <Share className="inline h-3.5 w-3.5 align-text-bottom" /> Partager, puis{" "}
              <SquarePlus className="inline h-3.5 w-3.5 align-text-bottom" />{" "}
              « Sur l&apos;écran d&apos;accueil »
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              Plein écran, icône sur l&apos;accueil, accès en un tap.
            </p>
          )}
          {platform === "android" && (
            <button
              type="button"
              onClick={install}
              className="mt-2.5 flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground active:scale-95 transition-transform"
            >
              <Download className="h-3.5 w-3.5" />
              Installer
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Fermer"
          className="shrink-0 rounded-lg p-1 text-muted-foreground transition-colors active:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
