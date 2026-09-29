"use client"

import { useState, useTransition } from "react"
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

/**
 * Action irréversible derrière une confirmation. Nommé pour la suppression, mais
 * sert aussi aux autres gestes définitifs (annuler une facture émise, marquer un
 * devis refusé) : `confirmLabel`, `pendingLabel` et `icon` s'adaptent au geste.
 */
export function DeleteConfirmButton({
  label,
  confirmTitle,
  confirmMessage,
  action,
  confirmLabel = "Supprimer définitivement",
  pendingLabel = "Suppression…",
  icon = <Trash2 className="h-4 w-4" />,
  variant = "destructive",
  className,
}: {
  label: string
  confirmTitle: string
  confirmMessage: string
  action: () => Promise<void>
  confirmLabel?: string
  pendingLabel?: string
  icon?: React.ReactNode
  variant?: "destructive" | "outline"
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleConfirm() {
    startTransition(async () => {
      await action()
      setOpen(false)
    })
  }

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size="sm"
        className={className}
        onClick={() => setOpen(true)}
      >
        {icon}
        {label}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{confirmTitle}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{confirmMessage}</p>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Annuler
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirm}
              disabled={isPending}
            >
              {isPending ? pendingLabel : confirmLabel}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
