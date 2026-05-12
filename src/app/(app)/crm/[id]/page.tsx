import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { updateClient, deleteClient } from "@/actions/crm"
import { redirect } from "next/navigation"
import { Mail, Phone, Building2, Tag, Trash2, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"

const sourceLabels: Record<string, string> = {
  WORD_OF_MOUTH: "Bouche à oreille",
  LINKEDIN: "LinkedIn",
  WEBSITE: "Site web",
  INBOUND: "Entrant",
  OTHER: "Autre",
}

const channelLabels: Record<string, string> = {
  EMAIL: "Email",
  CALL: "Appel",
  LINKEDIN: "LinkedIn",
  MEETING: "Réunion",
  SMS: "SMS",
  OTHER: "Autre",
}

export default async function ClientOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await auth()
  const userId = session!.user.id

  const client = await prisma.client.findFirst({
    where: { id, userId },
    include: {
      _count: { select: { interactions: true, projects: true, invoices: true } },
      interactions: { orderBy: { date: "desc" }, take: 3 },
      reminders: { where: { isDone: false }, orderBy: { dueDate: "asc" } },
      projects: { select: { id: true, name: true, status: true }, take: 5 },
      invoices: { select: { totalHT: true, status: true } },
    },
  })

  if (!client) notFound()

  const totalBilled = client.invoices
    .filter((i) => i.status === "PAID")
    .reduce((s, i) => s + i.totalHT, 0)

  const pendingAmount = client.invoices
    .filter((i) => i.status === "SENT" || i.status === "LATE")
    .reduce((s, i) => s + i.totalHT, 0)

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Left: contact info + notes */}
      <div className="lg:col-span-2 space-y-6">

        {/* Infos de contact */}
        <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
          <h2 className="font-semibold text-sm">Informations</h2>
          <div className="space-y-2.5">
            {client.email && (
              <div className="flex items-center gap-3 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <a href={`mailto:${client.email}`} className="hover:text-primary transition-colors">{client.email}</a>
              </div>
            )}
            {client.phone && (
              <div className="flex items-center gap-3 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                <a href={`tel:${client.phone}`} className="hover:text-primary transition-colors">{client.phone}</a>
              </div>
            )}
            {client.company && (
              <div className="flex items-center gap-3 text-sm">
                <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{client.company}</span>
              </div>
            )}
            <div className="flex items-center gap-3 text-sm">
              <Tag className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Source : {sourceLabels[client.source] ?? client.source}</span>
            </div>
          </div>

          {/* Edit form */}
          <form
            action={async (fd: FormData) => {
              "use server"
              await updateClient(id, userId, {
                name: fd.get("name") as string,
                company: (fd.get("company") as string) || null,
                email: (fd.get("email") as string) || null,
                phone: (fd.get("phone") as string) || null,
              })
            }}
            className="pt-2 space-y-3 border-t border-border"
          >
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Modifier</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Nom</label>
                <input name="name" defaultValue={client.name} className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Société</label>
                <input name="company" defaultValue={client.company ?? ""} className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Email</label>
                <input name="email" type="email" defaultValue={client.email ?? ""} className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Téléphone</label>
                <input name="phone" defaultValue={client.phone ?? ""} className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
              </div>
            </div>
            <Button type="submit" size="sm" variant="outline">Enregistrer</Button>
          </form>
        </div>

        {/* Notes */}
        <div className="rounded-xl border border-border/50 bg-card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold text-sm">Notes internes</h2>
          </div>
          <form
            action={async (fd: FormData) => {
              "use server"
              await updateClient(id, userId, { notes: (fd.get("notes") as string) || null })
            }}
            className="space-y-2"
          >
            <textarea
              name="notes"
              rows={4}
              defaultValue={client.notes ?? ""}
              placeholder="Notes privées sur ce contact..."
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            />
            <Button type="submit" size="sm" variant="outline">Enregistrer</Button>
          </form>
        </div>
      </div>

      {/* Right: stats + dernières interactions + projets */}
      <div className="space-y-6">

        {/* Stats */}
        <div className="rounded-xl border border-border/50 bg-card p-5 space-y-3">
          <h2 className="font-semibold text-sm">Statistiques</h2>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Interactions</span>
              <span className="font-medium">{client._count.interactions}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Projets</span>
              <span className="font-medium">{client._count.projects}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Facturé (payé)</span>
              <span className="font-medium text-emerald-600">{totalBilled.toLocaleString("fr-FR")} €</span>
            </div>
            {pendingAmount > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">En attente</span>
                <span className="font-medium text-amber-600">{pendingAmount.toLocaleString("fr-FR")} €</span>
              </div>
            )}
          </div>
        </div>

        {/* Projets */}
        {client.projects.length > 0 && (
          <div className="rounded-xl border border-border/50 bg-card p-5 space-y-3">
            <h2 className="font-semibold text-sm">Projets</h2>
            <div className="space-y-1.5">
              {client.projects.map((p) => (
                <a key={p.id} href={`/projets/${p.id}`} className="flex items-center gap-2 text-sm hover:text-primary transition-colors">
                  <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${p.status === "ACTIVE" ? "bg-emerald-500" : p.status === "PAUSED" ? "bg-amber-500" : "bg-muted-foreground"}`} />
                  {p.name}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Rappels en attente */}
        {client.reminders.length > 0 && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5 space-y-3">
            <h2 className="font-semibold text-sm text-amber-700 dark:text-amber-400">Rappels</h2>
            <div className="space-y-2">
              {client.reminders.map((r) => (
                <div key={r.id} className="text-sm">
                  <p className={`font-medium ${new Date(r.dueDate) < new Date() ? "text-red-500" : ""}`}>
                    {new Date(r.dueDate).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}
                  </p>
                  {r.note && <p className="text-muted-foreground text-xs">{r.note}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dernières interactions */}
        {client.interactions.length > 0 && (
          <div className="rounded-xl border border-border/50 bg-card p-5 space-y-3">
            <h2 className="font-semibold text-sm">Dernières interactions</h2>
            <div className="space-y-2">
              {client.interactions.map((i) => (
                <div key={i.id} className="border-l-2 border-border pl-3">
                  <p className="text-xs text-muted-foreground">
                    {channelLabels[i.channel]} · {new Date(i.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                  </p>
                  <p className="text-sm line-clamp-2">{i.summary}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Danger zone */}
        <form
          action={async () => {
            "use server"
            await deleteClient(id, userId)
            redirect("/crm")
          }}
        >
          <Button type="submit" variant="destructive" size="sm" className="w-full">
            <Trash2 className="h-3.5 w-3.5" />
            Supprimer ce contact
          </Button>
        </form>
      </div>
    </div>
  )
}
