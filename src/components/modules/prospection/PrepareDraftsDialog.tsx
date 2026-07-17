"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { NotebookPen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { generateEmailDrafts } from "@/actions/email-drafts"
import type { EmailTemplateOption, SendTarget } from "./SendEmailDialog"
import { toast } from "sonner"

/**
 * Génération de brouillons pour les prospects sélectionnés : choix du modèle,
 * puis un brouillon par prospect dans la file /prospection/brouillons.
 * RIEN n'est envoyé ici — la relecture et l'envoi se font dans la file.
 */
export function PrepareDraftsDialog({
  open,
  onOpenChange,
  templates,
  targets,
  onDone,
  initialTemplateId,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  templates: EmailTemplateOption[]
  targets: SendTarget[]
  onDone: () => void
  initialTemplateId?: string
}) {
  const router = useRouter()
  const [templateId, setTemplateId] = useState("")
  const [isPending, startTransition] = useTransition()

  // À l'ouverture, reprend le modèle éventuellement choisi en barre d'outils.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open && initialTemplateId) setTemplateId(initialTemplateId)
  }, [open, initialTemplateId])

  const template = templates.find((t) => t.id === templateId) ?? null
  const withoutEmailCount = targets.filter((t) => !t.email?.trim()).length

  function generate() {
    if (!template) return
    startTransition(async () => {
      try {
        const res = await generateEmailDrafts(targets.map((t) => t.id), template.id)
        toast.success(
          `${res.created} brouillon${res.created > 1 ? "s" : ""} créé${res.created > 1 ? "s" : ""}` +
            (res.skipped > 0 ? `, ${res.skipped} ignoré${res.skipped > 1 ? "s" : ""} (déjà en file)` : ""),
          {
            action: {
              label: "Ouvrir la file",
              onClick: () => router.push("/prospection/brouillons"),
            },
          }
        )
        onOpenChange(false)
        onDone()
        router.refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur lors de la génération")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Préparer les brouillons — {targets.length} prospect{targets.length > 1 ? "s" : ""}</DialogTitle>
        </DialogHeader>

        {templates.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun modèle de mail.{" "}
            <Link href="/prospection/modeles" className="text-primary hover:underline">Créer un modèle →</Link>
          </p>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Modèle</label>
              <select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">— Choisir un modèle —</option>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>

            <p className="text-xs text-muted-foreground">
              Un brouillon personnalisé est créé par prospect dans la file{" "}
              <Link href="/prospection/brouillons" className="text-primary hover:underline">Brouillons</Link>.
              Rien n&apos;est envoyé : chaque mail devra être relu et marqué « Relu », puis l&apos;envoi
              confirmé explicitement.
            </p>
            {withoutEmailCount > 0 && (
              <p className="text-xs text-amber-600">
                {withoutEmailCount} prospect{withoutEmailCount > 1 ? "s" : ""} sans email — brouillon créé
                quand même, le destinataire sera à renseigner à la relecture.
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={isPending}>
                Annuler
              </Button>
              <Button size="sm" onClick={generate} disabled={isPending || !template} className="gap-1.5">
                <NotebookPen className="h-3.5 w-3.5" />
                {isPending ? "Génération…" : `Créer ${targets.length} brouillon${targets.length > 1 ? "s" : ""}`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
