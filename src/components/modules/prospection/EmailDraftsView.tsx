"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, PenLine,
  Send, Undo2, XCircle, Save, Inbox,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import {
  updateEmailDraft,
  setEmailDraftReady,
  setEmailDraftBack,
  cancelEmailDraft,
  sendReadyDrafts,
} from "@/actions/email-drafts"
import { residualTemplateVars, isValidEmailAddress } from "@/lib/email-template"

export type DraftItem = {
  id: string
  emailTo: string | null
  subject: string
  body: string
  missingVars: string | null
  status: string // EmailDraftStatus
  sentAt: Date | string | null
  createdAt: Date | string
  client: { name: string; company: string | null; email: string | null }
  template: { name: string } | null
}

const fmtDateTime = (d: Date | string) =>
  new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })

/**
 * File de brouillons : cartes éditables une par une, marquage « relu »
 * explicite, et UN SEUL chemin d'envoi — le dialog de confirmation
 * récapitulatif. Jamais d'envoi automatique.
 */
export function EmailDraftsView({
  drafts,
  emailFromConfigured,
}: {
  drafts: DraftItem[]
  emailFromConfigured: boolean
}) {
  const router = useRouter()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [sentSectionOpen, setSentSectionOpen] = useState(false)
  const [isSending, startSending] = useTransition()

  const active = useMemo(() => drafts.filter((d) => d.status === "DRAFT" || d.status === "READY"), [drafts])
  const ready = useMemo(() => active.filter((d) => d.status === "READY"), [active])
  const draftCount = active.length - ready.length
  const sentRecent = useMemo(() => drafts.filter((d) => d.status === "SENT"), [drafts])

  function send() {
    startSending(async () => {
      try {
        const res = await sendReadyDrafts(ready.map((d) => d.id))
        const parts = [`${res.sent} email${res.sent > 1 ? "s" : ""} envoyé${res.sent > 1 ? "s" : ""}`]
        if (res.failed > 0) parts.push(`${res.failed} en échec (réessayez plus tard)`)
        if (res.refused > 0) parts.push(`${res.refused} refusé${res.refused > 1 ? "s" : ""} côté serveur (non relu ou invalide)`)
        const msg = parts.join(" · ")
        if (res.sent > 0 && res.failed === 0 && res.refused === 0) toast.success(msg)
        else if (res.sent > 0) toast.warning(msg)
        else toast.error(msg)
        setConfirmOpen(false)
        router.refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur lors de l'envoi")
      }
    })
  }

  return (
    <div className="space-y-4">
      {!emailFromConfigured && (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-700 dark:text-amber-400 space-y-1">
            <p className="font-medium">Adresse d&apos;envoi non configurée (RESEND_FROM_EMAIL)</p>
            <p>
              Le sandbox resend.dev n&apos;envoie qu&apos;à votre propre adresse. Vérifiez un domaine
              dans le dashboard Resend (SPF/DKIM) puis renseignez RESEND_FROM_EMAIL avec ce domaine.
              L&apos;envoi est désactivé en attendant — la relecture reste possible.
            </p>
          </div>
        </div>
      )}

      {/* ── Barre du haut : compteurs + envoi (seul chemin) ── */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground">
          <PenLine className="h-3 w-3" /> À relire : {draftCount}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="h-3 w-3" /> Relus : {ready.length}
        </span>
        {sentRecent.length > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground">
            <Send className="h-3 w-3" /> Envoyés (7 j) : {sentRecent.length}
          </span>
        )}
        <div className="ml-auto">
          <Button
            onClick={() => setConfirmOpen(true)}
            disabled={ready.length === 0 || !emailFromConfigured || isSending}
            className="gap-1.5 h-10"
            title={
              !emailFromConfigured
                ? "RESEND_FROM_EMAIL non configurée"
                : ready.length === 0
                  ? "Aucun brouillon relu — marquez d'abord des brouillons « Relu »"
                  : undefined
            }
          >
            <Send className="h-4 w-4" />
            Envoyer les emails relus ({ready.length})
          </Button>
        </div>
      </div>

      {/* ── File active ── */}
      {active.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-10 text-center">
          <Inbox className="h-6 w-6 text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">Aucun brouillon en file</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Depuis la page Prospection : sélectionnez des prospects puis « Préparer les brouillons »
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {active.map((d) => (
            <DraftCard key={d.id} draft={d} onChanged={() => router.refresh()} />
          ))}
        </div>
      )}

      {/* ── Envoyés récemment (repliée) ── */}
      {sentRecent.length > 0 && (
        <div className="rounded-xl border border-border/50 bg-card">
          <button
            onClick={() => setSentSectionOpen((v) => !v)}
            className="flex w-full items-center gap-2 px-4 py-3 min-h-10 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {sentSectionOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            Envoyés récemment ({sentRecent.length})
          </button>
          {sentSectionOpen && (
            <div className="divide-y divide-border/40 border-t border-border/40">
              {sentRecent.map((d) => (
                <div key={d.id} className="px-4 py-2.5 text-sm">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="font-medium">{d.client.name}</span>
                    {d.client.company && <span className="text-xs text-muted-foreground">{d.client.company}</span>}
                    <span className="text-xs text-muted-foreground">→ {d.emailTo}</span>
                    <span className="ml-auto text-xs text-muted-foreground whitespace-nowrap">
                      {d.sentAt ? fmtDateTime(d.sentAt) : ""}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{d.subject}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Dialog de confirmation — SEUL chemin d'envoi ── */}
      <Dialog open={confirmOpen} onOpenChange={(v) => { if (!isSending) setConfirmOpen(v) }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirmer l&apos;envoi de {ready.length} email{ready.length > 1 ? "s" : ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Seuls les brouillons marqués « Relu » partent. Vérifiez une dernière fois les destinataires :
            </p>
            <ul className="max-h-64 overflow-y-auto divide-y divide-border/40 rounded-lg border border-border/50">
              {ready.map((d) => (
                <li key={d.id} className="px-3 py-2 text-sm">
                  <div className="flex flex-wrap items-baseline gap-x-1.5">
                    <span className="font-medium">{d.client.name}</span>
                    <span className="text-xs text-muted-foreground">→ {d.emailTo}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{d.subject}</p>
                </li>
              ))}
            </ul>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={isSending} className="h-10 sm:h-8">
                Annuler
              </Button>
              <Button onClick={send} disabled={isSending || ready.length === 0} className="gap-1.5 h-10 sm:h-8">
                <Send className="h-3.5 w-3.5" />
                {isSending ? "Envoi en cours…" : `Envoyer ${ready.length} email${ready.length > 1 ? "s" : ""} maintenant`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/**
 * Carte d'un brouillon : destinataire/sujet/corps éditables, badge ambre si
 * variables manquantes, « Marquer relu » verrouillé tant que le mail n'est pas
 * complet. Toute édition (y compris via « Marquer relu » sur un texte modifié)
 * repasse d'abord par updateEmailDraft — le serveur re-vérifie tout.
 */
function DraftCard({ draft, onChanged }: { draft: DraftItem; onChanged: () => void }) {
  const [emailTo, setEmailTo] = useState(draft.emailTo ?? "")
  const [subject, setSubject] = useState(draft.subject)
  const [body, setBody] = useState(draft.body)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [isPending, startTransition] = useTransition()

  const isReady = draft.status === "READY"
  const dirty =
    emailTo !== (draft.emailTo ?? "") || subject !== draft.subject || body !== draft.body

  // Recalcul LIVE des {{variables}} non substituées dans le texte édité —
  // même logique que le serveur (residualTemplateVars).
  const liveResidual = useMemo(() => residualTemplateVars(subject, body), [subject, body])
  const storedMissing = draft.missingVars ? draft.missingVars.split(",").filter(Boolean) : []
  const emailOk = isValidEmailAddress(emailTo)

  // Pourquoi « Marquer relu » est désactivé (null = activable)
  const readyBlocked =
    liveResidual.length > 0
      ? `Variables non substituées dans le texte : ${liveResidual.map((v) => `{{${v}}}`).join(", ")}`
      : !emailOk
        ? "Destinataire vide ou invalide"
        : storedMissing.length > 0 && !dirty
          ? `Variables manquantes à la génération : ${storedMissing.join(", ")} — éditez le texte pour combler les trous`
          : null

  function run(fn: () => Promise<void>, successMsg?: string) {
    startTransition(async () => {
      try {
        await fn()
        if (successMsg) toast.success(successMsg)
        onChanged()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur")
      }
    })
  }

  const save = () =>
    run(async () => {
      await updateEmailDraft(draft.id, { subject, body, emailTo: emailTo.trim() || null })
    }, isReady ? "Enregistré — repassé en brouillon (nouvelle relecture requise)" : "Brouillon enregistré")

  // Édition en attente → on sauvegarde d'abord (recalcule missingVars côté
  // serveur), puis marquage relu. Le serveur re-refuse tout mail incomplet.
  const markReady = () =>
    run(async () => {
      if (dirty) await updateEmailDraft(draft.id, { subject, body, emailTo: emailTo.trim() || null })
      await setEmailDraftReady(draft.id)
    }, `« ${draft.client.name} » marqué relu`)

  const back = () => run(() => setEmailDraftBack(draft.id), "Repassé en brouillon")
  const cancel = () => {
    setConfirmCancel(false)
    run(() => cancelEmailDraft(draft.id), "Brouillon annulé (ne sera pas envoyé)")
  }

  const showMissingBadge = liveResidual.length > 0 || (storedMissing.length > 0 && !dirty)

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-4 space-y-3",
        isReady ? "border-emerald-500/40" : "border-border/50"
      )}
    >
      {/* En-tête : prospect + statut */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-medium text-sm">{draft.client.name}</span>
        {draft.client.company && (
          <span className="text-xs text-muted-foreground">· {draft.client.company}</span>
        )}
        {draft.template && (
          <span className="text-[10px] text-muted-foreground/70 rounded-full border border-border px-1.5 py-0.5">
            {draft.template.name}
          </span>
        )}
        <span className="ml-auto">
          {isReady ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" /> Relu — prêt à envoyer
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">
              <PenLine className="h-3 w-3" /> À relire
            </span>
          )}
        </span>
      </div>

      {showMissingBadge && (
        <div className="flex items-start gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Variables manquantes :{" "}
            {(liveResidual.length > 0 ? liveResidual : storedMissing).map((v) => `{{${v}}}`).join(", ")}
            {liveResidual.length === 0 && " — le texte généré contient des trous, relisez et complétez"}
          </p>
        </div>
      )}

      {/* Champs éditables */}
      <div className="grid gap-2">
        <div className="grid gap-1">
          <label className="text-xs text-muted-foreground" htmlFor={`to-${draft.id}`}>Destinataire</label>
          <input
            id={`to-${draft.id}`}
            type="email"
            value={emailTo}
            onChange={(e) => setEmailTo(e.target.value)}
            placeholder="email@exemple.fr"
            className={cn(
              "h-10 w-full rounded-lg border bg-transparent px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring",
              emailOk || emailTo === "" ? "border-input" : "border-destructive/60"
            )}
          />
        </div>
        <div className="grid gap-1">
          <label className="text-xs text-muted-foreground" htmlFor={`subject-${draft.id}`}>Sujet</label>
          <input
            id={`subject-${draft.id}`}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="grid gap-1">
          <label className="text-xs text-muted-foreground" htmlFor={`body-${draft.id}`}>Corps</label>
          <textarea
            id={`body-${draft.id}`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={Math.min(14, Math.max(6, body.split("\n").length + 1))}
            className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        {dirty && (
          <Button variant="outline" onClick={save} disabled={isPending} className="gap-1.5 h-10 sm:h-8">
            <Save className="h-3.5 w-3.5" /> Enregistrer
          </Button>
        )}
        {!isReady || dirty ? (
          <Button
            onClick={markReady}
            disabled={isPending || readyBlocked !== null}
            className="gap-1.5 h-10 sm:h-8"
            title={readyBlocked ?? undefined}
          >
            <CheckCircle2 className="h-3.5 w-3.5" /> Marquer relu
          </Button>
        ) : (
          <Button variant="outline" onClick={back} disabled={isPending} className="gap-1.5 h-10 sm:h-8">
            <Undo2 className="h-3.5 w-3.5" /> Repasser en brouillon
          </Button>
        )}

        <div className="ml-auto">
          {confirmCancel ? (
            <div className="flex items-center gap-2">
              <Button variant="destructive" onClick={cancel} disabled={isPending} className="h-10 sm:h-8">
                Confirmer l&apos;annulation
              </Button>
              <Button variant="ghost" onClick={() => setConfirmCancel(false)} disabled={isPending} className="h-10 sm:h-8">
                Non
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              onClick={() => setConfirmCancel(true)}
              disabled={isPending}
              className="gap-1.5 h-10 sm:h-8 text-muted-foreground hover:text-destructive"
            >
              <XCircle className="h-3.5 w-3.5" /> Annuler
            </Button>
          )}
        </div>
      </div>

      {readyBlocked && !isReady && (
        <p className="text-xs text-muted-foreground">{readyBlocked}</p>
      )}
    </div>
  )
}
