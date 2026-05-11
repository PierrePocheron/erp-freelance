"use client"

import { useState } from "react"
import { deleteAllUserData } from "@/actions/settings"
import { TriangleAlert, Loader2 } from "lucide-react"

export function DangerZone({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState("")
  const [deleting, setDeleting] = useState(false)

  const confirmed = input === "SUPPRIMER"

  async function handleDelete() {
    if (!confirmed) return
    setDeleting(true)
    await deleteAllUserData(userId)
  }

  return (
    <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <TriangleAlert className="h-4 w-4 text-red-500" />
        <h2 className="font-semibold text-sm text-red-600">Zone de danger</h2>
      </div>

      <div className="rounded-lg border border-red-500/20 bg-background p-4 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Supprimer toutes les données</p>
            <p className="text-xs text-muted-foreground mt-1">
              Supprime définitivement tous vos clients, projets, factures, devis, tâches et interactions. Cette action est irréversible.
            </p>
          </div>
          {!open && (
            <button
              onClick={() => setOpen(true)}
              className="shrink-0 rounded-lg border border-red-500 px-3 py-1.5 text-sm font-medium text-red-500 hover:bg-red-500/10 transition-colors"
            >
              Supprimer
            </button>
          )}
        </div>

        {open && (
          <div className="border-t border-border/50 pt-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Pour confirmer, tapez <span className="font-mono font-bold text-foreground">SUPPRIMER</span> ci-dessous&nbsp;:
            </p>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="SUPPRIMER"
              disabled={deleting}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-500/40 disabled:opacity-50"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setOpen(false); setInput("") }}
                disabled={deleting}
                className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted/50 transition-colors disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={handleDelete}
                disabled={!confirmed || deleting}
                className="flex items-center gap-2 rounded-lg bg-red-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {deleting ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" />Suppression…</>
                ) : "Confirmer la suppression"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
