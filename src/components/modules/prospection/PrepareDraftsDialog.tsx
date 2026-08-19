"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { NotebookPen, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { generateEmailDrafts } from "@/actions/email-drafts"
import { renderTemplate } from "@/lib/email-template"
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

  // Variables du modèle non renseignées pour chaque prospect — signalées AVANT
  // la génération (le brouillon est créé quand même, avec les trous à combler).
  const withMissing = useMemo(() => {
    if (!template) return []
    return targets
      .map((t) => ({ target: t, missing: renderTemplate(template, t).missing }))
      .filter((r) => r.missing.length > 0)
  }, [template, targets])

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

            {template && withMissing.length > 0 && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 space-y-1">
                <p className="flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  {withMissing.length} prospect{withMissing.length > 1 ? "s" : ""} avec des variables non renseignées :
                </p>
                <ul className="text-xs text-amber-700/80 dark:text-amber-400/80 max-h-28 overflow-y-auto space-y-0.5">
                  {withMissing.map((r) => (
                    <li key={r.target.id} className="truncate">
                      {r.target.name} — manque {r.missing.map((m) => `{{${m}}}`).join(", ")}
                    </li>
                  ))}
                </ul>
                <p className="text-[11px] text-amber-700/70 dark:text-amber-400/70">
                  Le brouillon est créé quand même, avec ces trous signalés à la relecture. Complétez la fiche du prospect pour les combler.
                </p>
              </div>
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
