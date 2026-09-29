"use client"

import { useEffect } from "react"
import { toast } from "sonner"
import type { Flash } from "@/lib/flash"

/** Affiche le message flash posé par une action serveur (voir lib/flash.ts), une seule fois. */
export function FlashToast({ flash }: { flash: Flash | null }) {
  useEffect(() => {
    if (!flash) return
    if (flash.kind === "error") toast.error(flash.message)
    else toast.success(flash.message)
    document.cookie = "flash=; Max-Age=0; path=/"
    // flash.id : deux messages identiques d'affilée restent deux événements
  }, [flash?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}
