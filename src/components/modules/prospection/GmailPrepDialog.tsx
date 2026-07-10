"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ExternalLink, Copy, Check, SkipForward } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { markProspectsContacted } from "@/actions/prospection"
import { renderTemplate } from "@/lib/email-template"
import type { EmailTemplateOption, SendTarget } from "./SendEmailDialog"
import { toast } from "sonner"

/**
 * Préparation des mails pour envoi manuel via Gmail : stepper prospect par
 * prospect, URL Gmail compose pré-remplie (mailto: est tronqué ~2 Ko selon
 * les handlers), boutons copier, "marqué envoyé" crée l'Interaction + bump statut.
 */
export function GmailPrepDialog({
  open,
  onOpenChange,
  templates,
  targets,
  onDone,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  templates: EmailTemplateOption[]
  targets: SendTarget[]
  onDone: () => void
}) {
  const router = useRouter()
  const [templateId, setTemplateId] = useState("")
  const [index, setIndex] = useState(0)
  const [sentCount, setSentCount] = useState(0)
  const [isPending, startTransition] = useTransition()

  const template = templates.find((t) => t.id === templateId) ?? null
  const withEmail = useMemo(() => targets.filter((t) => t.email?.trim()), [targets])
  const current = withEmail[index] ?? null
  const rendered = template && current ? renderTemplate(template, current) : null

  function gmailComposeUrl(): string {
    if (!current || !rendered) return "#"
    const params = new URLSearchParams({
      view: "cm",
      fs: "1",
      to: current.email!,
      su: rendered.subject,
      body: rendered.body,
    })
    return `https://mail.google.com/mail/?${params.toString()}`
  }

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text)
    toast.success(`${label} copié`)
  }

  function advance() {
    if (index + 1 < withEmail.length) {
      setIndex(index + 1)
    } else {
      toast.success(`Terminé — ${sentCount + 1} mail${sentCount + 1 > 1 ? "s" : ""} marqué${sentCount + 1 > 1 ? "s" : ""} envoyé${sentCount + 1 > 1 ? "s" : ""}`)
      onOpenChange(false)
      onDone()
      router.refresh()
    }
  }

  function markSentAndNext() {
    if (!current || !template) return
    startTransition(async () => {
      await markProspectsContacted([current.id], "EMAIL", `Email "${template.name}" envoyé via Gmail`)
      setSentCount((c) => c + 1)
      advance()
    })
  }

  function skip() {
    if (index + 1 < withEmail.length) setIndex(index + 1)
    else { onOpenChange(false); onDone(); router.refresh() }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setIndex(0); setSentCount(0) } }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Préparer pour Gmail — {withEmail.length} prospect{withEmail.length > 1 ? "s" : ""}</DialogTitle>
        </DialogHeader>

        {templates.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun modèle de mail.{" "}
            <Link href="/prospection/modeles" className="text-primary hover:underline">Créer un modèle →</Link>
          </p>
        ) : withEmail.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun des prospects sélectionnés n&apos;a d&apos;email.</p>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Modèle</label>
              <select
                value={templateId}
                onChange={(e) => { setTemplateId(e.target.value); setIndex(0) }}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">— Choisir un modèle —</option>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>

            {current && rendered && (
              <>
                <div className="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-2">
                  <p className="text-xs text-muted-foreground">
                    <span className="tabular-nums font-medium text-foreground">{index + 1}/{withEmail.length}</span> ·{" "}
                    <span className="font-medium text-foreground">{current.name}</span> &lt;{current.email}&gt;
                    {rendered.missing.length > 0 && (
                      <span className="text-amber-600"> · variables vides : {rendered.missing.join(", ")}</span>
                    )}
                  </p>
                  <p className="text-sm font-medium">{rendered.subject}</p>
                  <p className="text-xs text-muted-foreground whitespace-pre-line max-h-40 overflow-y-auto leading-relaxed">{rendered.body}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={gmailComposeUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Ouvrir dans Gmail
                  </a>
                  <button
                    onClick={() => copy(rendered.subject, "Objet")}
                    className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-input text-xs hover:bg-muted transition-colors"
                  >
                    <Copy className="h-3 w-3" /> Objet
                  </button>
                  <button
                    onClick={() => copy(rendered.body, "Corps")}
                    className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-input text-xs hover:bg-muted transition-colors"
                  >
                    <Copy className="h-3 w-3" /> Corps
                  </button>

                  <div className="ml-auto flex items-center gap-2">
                    <button
                      onClick={skip}
                      disabled={isPending}
                      className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                      title="Passer sans marquer envoyé"
                    >
                      <SkipForward className="h-3 w-3" /> Passer
                    </button>
                    <Button size="sm" onClick={markSentAndNext} disabled={isPending} className="gap-1.5">
                      <Check className="h-3.5 w-3.5" />
                      {isPending ? "…" : index + 1 < withEmail.length ? "Envoyé → suivant" : "Envoyé → terminer"}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
