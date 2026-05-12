"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Trash2, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { deleteProject } from "@/actions/projet"

export function ProjectDeleteButton({
  projectId,
  userId,
  projectName,
}: {
  projectId: string
  userId: string
  projectName: string
}) {
  const [open, setOpen] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleDelete() {
    startTransition(async () => {
      await deleteProject(projectId, userId)
      router.push("/projets")
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Supprimer le projet
      </button>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setConfirmed(false) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Supprimer le projet ?
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            <p className="text-sm text-muted-foreground">
              Le projet <span className="font-semibold text-foreground">{projectName}</span> sera supprimé définitivement avec toutes ses données :
            </p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Tâches et sous-tâches</li>
              <li>Jalons et livrables</li>
              <li>Liens utiles</li>
              <li>Journal de bord</li>
              <li>Entrées de time tracking</li>
            </ul>

            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="h-4 w-4 rounded border-border accent-destructive"
              />
              <span className="text-sm">Je comprends que cette action est irréversible</span>
            </label>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => { setOpen(false); setConfirmed(false) }}>
                Annuler
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={!confirmed || isPending}
                onClick={handleDelete}
              >
                {isPending ? "Suppression…" : "Supprimer définitivement"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
