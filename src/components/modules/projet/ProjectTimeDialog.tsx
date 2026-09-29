"use client"

import { useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Clock, Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

/**
 * Modale « Suivi du temps » de la fiche projet. Le contenu (KPIs, temps par tâche, entrées,
 * saisie manuelle, export) est un Server Component (ProjectTimePanel) que la page ne rend
 * QUE quand `?temps=1` est dans l'URL (#18) : ouvrir = naviguer vers ce paramètre, fermer =
 * le retirer. Avant, sa requête partait à chaque affichage de la fiche, modale fermée.
 */
export function ProjectTimeDialog({ open, children }: { open: boolean; children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  function setOpen(next: boolean) {
    const params = new URLSearchParams(searchParams.toString())
    if (next) params.set("temps", "1")
    else params.delete("temps")
    const qs = params.toString()
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }))
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={isPending && !open}
        className="inline-flex items-center gap-1.5 rounded-md border border-input px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-60"
      >
        {isPending && !open ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Clock className="h-3.5 w-3.5" />} Détail &amp; saisie
      </button>
      <Dialog open={open} onOpenChange={(o) => { if (!o) setOpen(false) }}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Suivi du temps</DialogTitle>
          </DialogHeader>
          {children}
        </DialogContent>
      </Dialog>
    </>
  )
}
