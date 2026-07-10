"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Send, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { sendProspectionEmails } from "@/actions/prospection"
import { renderTemplate, type TemplateProspect } from "@/lib/email-template"
import { toast } from "sonner"

export type EmailTemplateOption = { id: string; name: string; subject: string; body: string }
export type SendTarget = TemplateProspect & { id: string; email: string | null }

/**
 * Envoi d'un modèle personnalisé aux prospects sélectionnés via Resend.
 * Préview par prospect (navigation), avertissements variables manquantes /
 * sans email / RESEND_FROM absent.
 */
export function SendEmailDialog({
  open,
  onOpenChange,
  templates,
  targets,
  emailFromConfigured,
  onSent,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  templates: EmailTemplateOption[]
  targets: SendTarget[]
  emailFromConfigured: boolean
  onSent: () => void
}) {
  const router = useRouter()
  const [templateId, setTemplateId] = useState("")
  const [previewIndex, setPreviewIndex] = useState(0)
  const [isPending, startTransition] = useTransition()

  const template = templates.find((t) => t.id === templateId) ?? null
  const withEmail = useMemo(() => targets.filter((t) => t.email?.trim()), [targets])
  const withoutEmailCount = targets.length - withEmail.length

  // Rendu par prospect (préview + détection des variables manquantes)
  const rendered = useMemo(() => {
    if (!template) return []
    return withEmail.map((p) => ({ prospect: p, ...renderTemplate(template, p) }))
  }, [template, withEmail])

  const withMissing = rendered.filter((r) => r.missing.length > 0)
  // Vérification stricte : un prospect avec une variable non renseignée est
  // exclu de l'envoi (pas de mail à trous), listé explicitement dans le dialog.
  const readyToSend = rendered.filter((r) => r.missing.length === 0)
  const current = rendered[Math.min(previewIndex, rendered.length - 1)]

  function send() {
    if (!template || readyToSend.length === 0) return
    startTransition(async () => {
      try {
        const res = await sendProspectionEmails(template.id, readyToSend.map((r) => r.prospect.id))
        toast.success(`${res.sent} mail${res.sent > 1 ? "s" : ""} envoyé${res.sent > 1 ? "s" : ""}${res.failed > 0 ? ` · ${res.failed} en échec` : ""}`)
        onOpenChange(false)
        onSent()
        router.refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur lors de l'envoi")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Envoyer un mail à {targets.length} prospect{targets.length > 1 ? "s" : ""}</DialogTitle>
        </DialogHeader>

        {!emailFromConfigured && (
          <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-700 dark:text-amber-400 space-y-1">
              <p className="font-medium">Adresse d&apos;envoi non configurée (RESEND_FROM_EMAIL)</p>
              <p>
                Le sandbox resend.dev n&apos;envoie qu&apos;à votre propre adresse. Vérifiez un domaine
                dans le dashboard Resend (SPF/DKIM) puis renseignez RESEND_FROM_EMAIL avec ce domaine.
              </p>
            </div>
          </div>
        )}

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
                onChange={(e) => { setTemplateId(e.target.value); setPreviewIndex(0) }}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">— Choisir un modèle —</option>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>

            {withoutEmailCount > 0 && (
              <p className="text-xs text-amber-600">
                {withoutEmailCount} prospect{withoutEmailCount > 1 ? "s" : ""} sans email — exclu{withoutEmailCount > 1 ? "s" : ""} de l&apos;envoi.
              </p>
            )}
            {template && withMissing.length > 0 && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 space-y-1">
                <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                  {withMissing.length} prospect{withMissing.length > 1 ? "s" : ""} exclu{withMissing.length > 1 ? "s" : ""} de l&apos;envoi — variables non renseignées :
                </p>
                <ul className="text-xs text-amber-700/80 dark:text-amber-400/80 max-h-24 overflow-y-auto">
                  {withMissing.map((r) => (
                    <li key={r.prospect.id} className="truncate">
                      {r.prospect.name} — manque {r.missing.map((m) => `{{${m}}}`).join(", ")}
                    </li>
                  ))}
                </ul>
                <p className="text-[11px] text-amber-700/70 dark:text-amber-400/70">
                  Complétez la fiche du prospect (ou changez de modèle) pour les inclure.
                </p>
              </div>
            )}

            {/* Préview navigable */}
            {current && (
              <div className="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground truncate">
                    Aperçu : <span className="font-medium text-foreground">{current.prospect.name}</span> &lt;{current.prospect.email}&gt;
                    {current.missing.length > 0 && <span className="text-amber-600"> · variables vides : {current.missing.join(", ")}</span>}
                  </p>
                  {rendered.length > 1 && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => setPreviewIndex((i) => Math.max(0, i - 1))} disabled={previewIndex <= 0} className="h-6 w-6 flex items-center justify-center rounded border border-input hover:bg-muted disabled:opacity-40">
                        <ChevronLeft className="h-3 w-3" />
                      </button>
                      <span className="text-[10px] text-muted-foreground tabular-nums">{previewIndex + 1}/{rendered.length}</span>
                      <button onClick={() => setPreviewIndex((i) => Math.min(rendered.length - 1, i + 1))} disabled={previewIndex >= rendered.length - 1} className="h-6 w-6 flex items-center justify-center rounded border border-input hover:bg-muted disabled:opacity-40">
                        <ChevronRight className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
                <p className="text-sm font-medium">{current.subject}</p>
                <p className="text-xs text-muted-foreground whitespace-pre-line max-h-48 overflow-y-auto leading-relaxed">{current.body}</p>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={isPending}>
                Annuler
              </Button>
              <Button
                size="sm"
                onClick={send}
                disabled={isPending || !template || readyToSend.length === 0 || !emailFromConfigured}
                className="gap-1.5"
              >
                <Send className="h-3.5 w-3.5" />
                {isPending ? "Envoi…" : `Envoyer à ${readyToSend.length}`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
