"use client"

import Link from "next/link"
import { useTransition } from "react"
import {
  Mail, Phone, ExternalLink, Building2,
  MessageSquare, Bell, FolderKanban, FileText, Receipt,
  Phone as PhoneIcon, Mail as MailIcon, Video, Users,
  UserCheck, Archive,
} from "lucide-react"
import { updateClientType } from "@/actions/crm"
import { toast } from "sonner"

const tempConfig = {
  COLD: { dot: "bg-blue-500", label: "Froid" },
  WARM: { dot: "bg-amber-500", label: "Tiède" },
  HOT: { dot: "bg-red-500", label: "Chaud" },
}

const typeConfig = {
  TO_COMPLETE: { label: "À compléter", className: "bg-rose-500/15 text-rose-600 border-rose-500/20" },
  PROSPECT: { label: "Prospect", className: "bg-amber-500/15 text-amber-600 border-amber-500/20" },
  CLIENT: { label: "Client", className: "bg-emerald-500/15 text-emerald-600 border-emerald-500/20" },
  PERSONAL: { label: "Perso", className: "bg-violet-500/15 text-violet-600 border-violet-500/20" },
  SELF: { label: "Perso", className: "bg-indigo-500/15 text-indigo-600 border-indigo-500/20" },
  INACTIVE: { label: "Inactif", className: "bg-muted text-muted-foreground border-border" },
}

const channelIcon: Record<string, React.ReactNode> = {
  EMAIL: <MailIcon className="h-3 w-3" />,
  CALL: <PhoneIcon className="h-3 w-3" />,
  MEETING: <Users className="h-3 w-3" />,
  LINKEDIN: <Users className="h-3 w-3" />,
  VIDEO: <Video className="h-3 w-3" />,
  SMS: <MessageSquare className="h-3 w-3" />,
  OTHER: <MessageSquare className="h-3 w-3" />,
}

const projectStatusConfig: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: "Actif", className: "bg-emerald-500/15 text-emerald-600 border-emerald-500/20" },
  PAUSED: { label: "En pause", className: "bg-amber-500/15 text-amber-600 border-amber-500/20" },
  COMPLETED: { label: "Terminé", className: "bg-blue-500/15 text-blue-600 border-blue-500/20" },
  ARCHIVED: { label: "Archivé", className: "bg-muted text-muted-foreground border-border" },
}

const invoiceStatusConfig: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Brouillon", className: "text-muted-foreground" },
  SENT: { label: "Envoyée", className: "text-blue-600" },
  PAID: { label: "Payée", className: "text-emerald-600" },
  LATE: { label: "En retard", className: "text-red-500" },
  CANCELLED: { label: "Annulée", className: "text-muted-foreground" },
}

const quoteStatusConfig: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Brouillon", className: "text-muted-foreground" },
  SENT: { label: "Envoyé", className: "text-blue-600" },
  ACCEPTED: { label: "Accepté", className: "text-emerald-600" },
  REJECTED: { label: "Refusé", className: "text-red-500" },
}

type Interaction = { id: string; date: Date | string; channel: string; summary: string }
type Reminder = { id: string; dueDate: Date | string; note: string | null }
type Project = { id: string; name: string; status: string }
type Invoice = { id: string; number: string; status: string; totalHT: number; depositDeducted: number; createdAt: Date | string }
type Quote = { id: string; number: string; status: string; totalHT: number; createdAt: Date | string }

type ClientPanelData = {
  id: string
  name: string
  company: string | null
  email: string | null
  phone: string | null
  type: string
  temperature: string
  source: string
  notes: string | null
  interactions: Interaction[]
  reminders: Reminder[]
  projects: Project[]
  invoices: Invoice[]
  quotes: Quote[]
  _count: { interactions: number; projects: number; invoices: number; quotes: number }
}

export function ClientPanel({
  client,
  loading,
  userId,
}: {
  client: ClientPanelData | null
  loading: boolean
  userId?: string
}) {
  const [isPending, startTransition] = useTransition()

  const fmt = (d: Date | string) =>
    new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })

  function changeType(type: string, label: string) {
    if (!client || !userId) return
    startTransition(async () => {
      await updateClientType(client.id, userId, type)
      toast.success(`Statut mis à jour : ${label}`)
    })
  }

  if (loading || !client) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-2 text-muted-foreground">
        <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30 border-t-primary animate-spin" />
        <span className="text-sm">Chargement…</span>
      </div>
    )
  }

  const temp = tempConfig[client.temperature as keyof typeof tempConfig]
  const type = typeConfig[client.type as keyof typeof typeConfig]

  const billed = client.invoices
    .filter((i) => i.status === "PAID")
    .reduce((s, i) => s + i.totalHT - i.depositDeducted, 0)
  const pending = client.invoices
    .filter((i) => ["SENT", "LATE"].includes(i.status))
    .reduce((s, i) => s + i.totalHT - i.depositDeducted, 0)

  return (
    <div className="flex flex-col h-full overflow-y-auto">

      {/* Header — pr-10 pour dégager la croix de fermeture du Sheet (absolute top-3 right-3) */}
      <div className="p-5 pr-10 border-b border-border/50 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`h-2 w-2 rounded-full ${temp.dot}`} title={temp.label} />
              {client.company && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  {client.company}
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold">{client.name}</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${type.className}`}>
              {type.label}
            </span>
            <Link
              href={`/client/${client.id}`}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              title="Ouvrir la fiche complète"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* Contact */}
        <div className="flex flex-col gap-1">
          {client.email && (
            <a href={`mailto:${client.email}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <Mail className="h-3.5 w-3.5 shrink-0" />
              {client.email}
            </a>
          )}
          {client.phone && (
            <a href={`tel:${client.phone}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <Phone className="h-3.5 w-3.5 shrink-0" />
              {client.phone}
            </a>
          )}
        </div>

        {/* Quick actions */}
        <div className="flex flex-wrap gap-2">
          {client.email && (
            <a
              href={`mailto:${client.email}`}
              className="flex items-center gap-1.5 rounded-lg border border-border/50 px-3 py-1.5 text-xs font-medium hover:bg-muted/50 transition-colors"
            >
              <Mail className="h-3.5 w-3.5" /> E-mail
            </a>
          )}
          {client.phone && (
            <a
              href={`tel:${client.phone}`}
              className="flex items-center gap-1.5 rounded-lg border border-border/50 px-3 py-1.5 text-xs font-medium hover:bg-muted/50 transition-colors"
            >
              <Phone className="h-3.5 w-3.5" /> Appeler
            </a>
          )}
          {client.type === "PROSPECT" && userId && (
            <button
              onClick={() => changeType("CLIENT", "Client")}
              disabled={isPending}
              className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors"
            >
              <UserCheck className="h-3.5 w-3.5" /> Convertir en client
            </button>
          )}
          {(client.type === "PROSPECT" || client.type === "CLIENT") && userId && (
            <button
              onClick={() => changeType("INACTIVE", "Inactif")}
              disabled={isPending}
              className="flex items-center gap-1.5 rounded-lg border border-border/50 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
            >
              <Archive className="h-3.5 w-3.5" /> Archiver
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 border-b border-border/50">
        <div className="p-3 text-center border-r border-border/50">
          <p className="text-lg font-bold">{client._count.projects}</p>
          <p className="text-xs text-muted-foreground">projets</p>
        </div>
        <div className="p-3 text-center border-r border-border/50">
          <p className="text-lg font-bold">{billed > 0 ? `${billed.toLocaleString("fr-FR")}€` : "—"}</p>
          <p className="text-xs text-muted-foreground">facturé</p>
        </div>
        <div className="p-3 text-center">
          <p className={`text-lg font-bold ${pending > 0 ? "text-amber-600" : ""}`}>
            {pending > 0 ? `${pending.toLocaleString("fr-FR")}€` : "—"}
          </p>
          <p className="text-xs text-muted-foreground">en attente</p>
        </div>
      </div>

      <div className="flex-1 p-4 space-y-5">

        {/* Reminders */}
        {client.reminders.length > 0 && (
          <section className="space-y-2">
            <SectionHeader icon={<Bell className="h-3 w-3" />} label="Rappels" href={`/client/${client.id}/rappels`} />
            <div className="space-y-1.5">
              {client.reminders.map((r) => {
                const isLate = new Date(r.dueDate) < new Date()
                return (
                  <div key={r.id} className={`flex items-start gap-2 rounded-lg p-2 text-sm ${isLate ? "bg-red-500/5 border border-red-500/20" : "bg-amber-500/5 border border-amber-500/20"}`}>
                    <span className={`text-xs font-medium mt-0.5 shrink-0 ${isLate ? "text-red-500" : "text-amber-600"}`}>
                      {fmt(r.dueDate)}
                    </span>
                    {r.note && <span className="text-xs text-muted-foreground truncate">{r.note}</span>}
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Interactions */}
        {client.interactions.length > 0 && (
          <section className="space-y-2">
            <SectionHeader icon={<MessageSquare className="h-3 w-3" />} label="Interactions" count={client._count.interactions} href={`/client/${client.id}/interactions`} />
            <div className="space-y-1.5">
              {client.interactions.map((i) => (
                <div key={i.id} className="flex items-start gap-2 rounded-lg border border-border/50 p-2">
                  <span className="text-muted-foreground mt-0.5 shrink-0">
                    {channelIcon[i.channel] ?? <MessageSquare className="h-3 w-3" />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground mb-0.5">{fmt(i.date)}</p>
                    <p className="text-sm truncate">{i.summary}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Projects */}
        {client.projects.length > 0 && (
          <section className="space-y-2">
            <SectionHeader icon={<FolderKanban className="h-3 w-3" />} label="Projets" count={client._count.projects} href={`/client/${client.id}/projets`} />
            <div className="space-y-1.5">
              {client.projects.map((p) => {
                const ps = projectStatusConfig[p.status] ?? { label: p.status, className: "text-muted-foreground" }
                return (
                  <Link
                    key={p.id}
                    href={`/projets/${p.id}`}
                    className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2 hover:bg-muted/50 transition-colors group"
                  >
                    <span className="text-sm font-medium truncate group-hover:text-primary transition-colors">{p.name}</span>
                    <span className={`shrink-0 ml-2 rounded-full border px-2 py-0.5 text-xs font-medium ${ps.className}`}>
                      {ps.label}
                    </span>
                  </Link>
                )
              })}
            </div>
          </section>
        )}

        {/* Invoices */}
        {client.invoices.length > 0 && (
          <section className="space-y-2">
            <SectionHeader icon={<Receipt className="h-3 w-3" />} label="Factures" count={client._count.invoices} href="/facturation/factures" />
            <div className="rounded-lg border border-border/50 overflow-hidden">
              {client.invoices.map((inv, i) => {
                const is = invoiceStatusConfig[inv.status] ?? { label: inv.status, className: "text-muted-foreground" }
                return (
                  <Link
                    key={inv.id}
                    href={`/facturation/factures/${inv.id}`}
                    className={`flex items-center gap-3 px-3 py-2 hover:bg-muted/50 transition-colors group ${i !== 0 ? "border-t border-border/50" : ""}`}
                  >
                    <span className="font-mono text-xs text-muted-foreground shrink-0">{inv.number}</span>
                    <span className={`text-xs font-medium shrink-0 ${is.className}`}>{is.label}</span>
                    <span className="flex-1 text-right text-sm font-semibold group-hover:text-primary transition-colors">
                      {inv.totalHT.toLocaleString("fr-FR")} €
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">{fmt(inv.createdAt)}</span>
                  </Link>
                )
              })}
            </div>
          </section>
        )}

        {/* Quotes */}
        {client.quotes.length > 0 && (
          <section className="space-y-2">
            <SectionHeader icon={<FileText className="h-3 w-3" />} label="Devis" count={client._count.quotes} href="/facturation/devis" />
            <div className="rounded-lg border border-border/50 overflow-hidden">
              {client.quotes.map((q, i) => {
                const qs = quoteStatusConfig[q.status] ?? { label: q.status, className: "text-muted-foreground" }
                return (
                  <Link
                    key={q.id}
                    href={`/facturation/devis/${q.id}`}
                    className={`flex items-center gap-3 px-3 py-2 hover:bg-muted/50 transition-colors group ${i !== 0 ? "border-t border-border/50" : ""}`}
                  >
                    <span className="font-mono text-xs text-muted-foreground shrink-0">{q.number}</span>
                    <span className={`text-xs font-medium shrink-0 ${qs.className}`}>{qs.label}</span>
                    <span className="flex-1 text-right text-sm font-semibold group-hover:text-primary transition-colors">
                      {q.totalHT.toLocaleString("fr-FR")} €
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">{fmt(q.createdAt)}</span>
                  </Link>
                )
              })}
            </div>
          </section>
        )}

        {/* Notes */}
        {client.notes && (
          <section className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes</h3>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{client.notes}</p>
          </section>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border/50">
        <Link
          href={`/client/${client.id}`}
          className="flex items-center justify-center gap-2 w-full rounded-lg border border-border/50 px-4 py-2 text-sm font-medium hover:bg-muted/50 transition-colors"
        >
          Ouvrir la fiche complète
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  )
}

function SectionHeader({
  icon,
  label,
  count,
  href,
}: {
  icon: React.ReactNode
  label: string
  count?: number
  href: string
}) {
  return (
    <div className="flex items-center justify-between">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
        {icon} {label}
        {count !== undefined && count > 0 && (
          <span className="ml-1 text-muted-foreground/60 font-normal normal-case tracking-normal">({count})</span>
        )}
      </h3>
      <Link href={href} className="text-xs text-primary hover:underline">Voir tout</Link>
    </div>
  )
}
