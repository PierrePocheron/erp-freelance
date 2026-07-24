"use client"

import { useState } from "react"
import Link from "next/link"
import { BellRing, ChevronDown, Send } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { renderTemplate, stripMarkdown } from "@/lib/email-template"

type FollowUp = {
  id: string
  name: string
  firstName: string | null
  lastName: string | null
  company: string | null
  websiteUrl: string | null
  city: string | null
  region: string | null
  businessDescription: string | null
  cms: string | null
  seoScore: number | null
  seoIssues: string | null
  publicationManager: string | null
  domainCreatedAt: Date | string | null
  email: string | null
  interestLevel: number | null
  lastEmail: { date: Date | string; emailTemplateName: string | null } | null
}

type RelanceTemplate = { id: string; name: string; subject: string; body: string }

function daysSince(d: Date | string): number {
  return Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000)
}

/**
 * Rappel « relances à faire » : prospects contactés il y a ≥ N jours, sans
 * réponse, dont le dernier email remonte à plus de N jours. Liste dérivée (aucun
 * champ à maintenir) — pour ne pas oublier de relancer. Clic sur le nom → fiche.
 *
 * Si un modèle de relance par défaut est configuré (Réglages › Prospection), un
 * bouton « Relancer » ouvre Gmail pré-rempli avec ce modèle rendu pour le
 * prospect. Ouvrir ≠ envoyer : le suivi reste explicite (aucun marquage auto).
 */
export function FollowUpsCard({
  items,
  delayDays,
  relanceTemplate,
}: {
  items: FollowUp[]
  delayDays: number
  relanceTemplate: RelanceTemplate | null
}) {
  const [open, setOpen] = useState(true)
  if (items.length === 0) return null

  function relance(p: FollowUp) {
    if (!relanceTemplate) return
    if (!p.email?.trim()) {
      toast.error(`${p.company || p.name} n'a pas d'email`)
      return
    }
    const rendered = renderTemplate(relanceTemplate, p)
    const params = new URLSearchParams({
      view: "cm",
      fs: "1",
      to: p.email,
      su: rendered.subject,
      body: stripMarkdown(rendered.body),
    })
    window.open(`https://mail.google.com/mail/?${params.toString()}`, "_blank", "noopener,noreferrer")
    const who = p.company || p.name
    if (rendered.missing.length > 0) toast.warning(`Relance générée pour ${who} — variables vides : ${rendered.missing.join(", ")}`)
    else toast.success(`Relance générée pour ${who}`)
  }

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
      >
        <BellRing className="h-4 w-4 text-amber-600 shrink-0" />
        <span className="text-sm font-semibold">
          {items.length} relance{items.length > 1 ? "s" : ""} à faire
        </span>
        <span className="hidden sm:inline text-xs text-muted-foreground">
          · contactés il y a {delayDays} jour{delayDays > 1 ? "s" : ""} ou plus, sans réponse
          {relanceTemplate ? ` · modèle « ${relanceTemplate.name} »` : ""}
        </span>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground ml-auto shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="divide-y divide-border/40 border-t border-amber-500/20 max-h-72 overflow-y-auto">
          {items.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-2 px-4 py-2 hover:bg-amber-500/10 transition-colors"
            >
              <Link href={`/contacts/${p.id}`} className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{p.company || p.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {p.lastEmail
                    ? `Dernier email il y a ${daysSince(p.lastEmail.date)} j${p.lastEmail.emailTemplateName ? ` · ${p.lastEmail.emailTemplateName}` : ""}`
                    : "Contacté, en attente de retour"}
                </p>
              </Link>
              {p.interestLevel != null && (
                <span className="shrink-0 rounded-full border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground whitespace-nowrap">
                  intérêt {p.interestLevel}
                </span>
              )}
              {relanceTemplate && (
                <button
                  type="button"
                  onClick={() => relance(p)}
                  disabled={!p.email?.trim()}
                  title={p.email?.trim() ? `Relancer avec « ${relanceTemplate.name} »` : "Pas d'email pour ce prospect"}
                  className="shrink-0 inline-flex items-center gap-1 h-7 px-2 rounded-md border border-amber-500/40 bg-background text-xs font-medium text-amber-700 hover:bg-amber-500/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="h-3 w-3" />
                  Relancer
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
