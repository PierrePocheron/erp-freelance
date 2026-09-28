"use client"

import { Clock } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

/**
 * Modale « Suivi du temps » de la fiche projet. Le contenu (KPIs, temps par tâche, entrées,
 * saisie manuelle, export) est un Server Component passé en children — voir ProjectTimePanel.
 * Le suivi du temps est secondaire : il ne mérite plus un onglet, juste une carte + cette modale.
 */
export function ProjectTimeDialog({ children }: { children: React.ReactNode }) {
  return (
    <Dialog>
      <DialogTrigger
        render={
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-input px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          />
        }
      >
        <Clock className="h-3.5 w-3.5" /> Détail &amp; saisie
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Suivi du temps</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  )
}
