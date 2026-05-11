"use client"

import Link from "next/link"
import {
  Mail, Phone, ExternalLink, Building2,
  MessageSquare, Bell, FolderKanban,
  Phone as PhoneIcon, Mail as MailIcon, Video, Users,
} from "lucide-react"

const tempConfig = {
  COLD: { dot: "bg-blue-500", label: "Froid" },
  WARM: { dot: "bg-amber-500", label: "Tiède" },
  HOT: { dot: "bg-red-500", label: "Chaud" },
}

const typeConfig = {
  PROSPECT: { label: "Prospect", className: "bg-amber-500/15 text-amber-600 border-amber-500/20" },
  CLIENT: { label: "Client", className: "bg-emerald-500/15 text-emerald-600 border-emerald-500/20" },
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

const projectStatusLabel: Record<string, string> = {
  ACTIVE: "Actif",
  PAUSED: "Pausé",
  COMPLETED: "Terminé",
  ARCHIVED: "Archivé",
}

type Interaction = { id: string; date: Date | string; channel: string; summary: string }
type Reminder = { id: string; dueDate: Date | string; note: string | null }
type Project = { id: string; name: string; status: string }
type Invoice = { totalHT: number; depositDeducted: number; status: string }

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
  _count: { interactions: number; projects: number }
}

export function ClientPanel({
  client,
  loading,
}: {
  client: ClientPanelData | null
  loading: boolean
}) {
  const fmt = (d: Date | string) =>
    new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })

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
    .filter((i) => ["SENT", "DRAFT"].includes(i.status))
    .reduce((s, i) => s + i.totalHT - i.depositDeducted, 0)

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="p-5 border-b border-border/50 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`h-2.5 w-2.5 rounded-full ${temp.dot}`} title={temp.label} />
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
              href={`/crm/${client.id}`}
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
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Bell className="h-3 w-3" /> Rappels
              </h3>
              <Link href={`/crm/${client.id}/rappels`} className="text-xs text-primary hover:underline">Voir tout</Link>
            </div>
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
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <MessageSquare className="h-3 w-3" /> Interactions
              </h3>
              <Link href={`/crm/${client.id}/interactions`} className="text-xs text-primary hover:underline">Voir tout</Link>
            </div>
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

        {/* Active projects */}
        {client.projects.length > 0 && (
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <FolderKanban className="h-3 w-3" /> Projets
              </h3>
              <Link href={`/crm/${client.id}/projets`} className="text-xs text-primary hover:underline">Voir tout</Link>
            </div>
            <div className="space-y-1.5">
              {client.projects.map((p) => (
                <Link key={p.id} href={`/projets/${p.id}`} className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2 hover:bg-muted/50 transition-colors">
                  <span className="text-sm font-medium truncate">{p.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0 ml-2">{projectStatusLabel[p.status] ?? p.status}</span>
                </Link>
              ))}
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

      {/* Footer actions */}
      <div className="p-4 border-t border-border/50">
        <Link
          href={`/crm/${client.id}`}
          className="flex items-center justify-center gap-2 w-full rounded-lg border border-border/50 px-4 py-2 text-sm font-medium hover:bg-muted/50 transition-colors"
        >
          Ouvrir la fiche complète
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  )
}
