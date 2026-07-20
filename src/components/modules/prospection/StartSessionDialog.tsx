"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { STATUS_CONFIG, PIPELINE_STATUSES, WEBSITE_TYPE_CONFIG } from "./status-config"
import type { ProspectStatus, WebsiteType } from "@/generated/prisma/enums"

/**
 * Lancement d'une session de prospection sans sélection préalable : le dialog
 * rappelle qu'on peut cocher des lignes dans le tableau, ou laisse
 * l'application choisir selon des conditions (statut, type de site, nombre).
 */
export function StartSessionDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [statut, setStatut] = useState<ProspectStatus | "ALL">("TO_CONTACT")
  const [siteType, setSiteType] = useState<WebsiteType | "ALL">("ALL")
  const [count, setCount] = useState(10)

  function launch() {
    const params = new URLSearchParams()
    if (statut !== "ALL") params.set("statut", statut)
    if (siteType !== "ALL") params.set("type", siteType)
    params.set("n", String(count))
    setOpen(false)
    router.push(`/prospection/mode?${params.toString()}`)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" className="gap-1.5" />}>
        <Play className="h-3.5 w-3.5" />
        Démarrer une session
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Démarrer une session de prospection</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Aucun prospect sélectionné. Coche des lignes dans le tableau puis
            utilise «&nbsp;Mode prospection&nbsp;» dans la barre d&apos;actions —
            ou laisse l&apos;application choisir selon ces conditions&nbsp;:
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Statut</label>
              <select
                value={statut}
                onChange={(e) => setStatut(e.target.value as ProspectStatus | "ALL")}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="ALL">Tous les statuts actifs</option>
                {PIPELINE_STATUSES.map((s) => (
                  <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Type de site</label>
              <select
                value={siteType}
                onChange={(e) => setSiteType(e.target.value as WebsiteType | "ALL")}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="ALL">Tous les types</option>
                {(Object.keys(WEBSITE_TYPE_CONFIG) as WebsiteType[]).map((t) => (
                  <option key={t} value={t}>{WEBSITE_TYPE_CONFIG[t].label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Nombre de prospects</label>
            <div className="flex gap-1.5">
              {[5, 10, 20, 30].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setCount(n)}
                  className={`h-8 px-3 rounded-lg border text-sm transition-colors ${
                    count === n
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-input text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>Annuler</Button>
            <Button type="button" size="sm" onClick={launch} className="gap-1.5">
              <Play className="h-3.5 w-3.5" /> Lancer la session
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
