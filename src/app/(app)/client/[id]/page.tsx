import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { redirect } from "next/navigation"
import { deleteClient } from "@/actions/crm"
import { FolderKanban, Receipt, FileText, Bell, MessageSquare, Trash2 } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ClientInfoCard } from "@/components/modules/crm/ClientInfoCard"
import { ClientTasksSection } from "@/components/modules/crm/ClientTasksSection"

const channelLabels: Record<string, string> = {
  EMAIL: "Email", CALL: "Appel", LINKEDIN: "LinkedIn",
  MEETING: "Réunion", SMS: "SMS", OTHER: "Autre",
}

const projectStatusDot: Record<string, string> = {
  ACTIVE: "bg-emerald-500", PAUSED: "bg-amber-500",
  COMPLETED: "bg-blue-500", ARCHIVED: "bg-muted-foreground",
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
      invoices: { select: { totalHT: true, depositDeducted: true, status: true } },
      tasks: {
        where: { isGroup: false, parentTaskId: null },
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          priority: true,
          importance: true,
          estimatedHours: true,
          dueDate: true,
          startedAt: true,
          completedAt: true,
          project: { select: { id: true, name: true } },
          taskTags: { select: { id: true, name: true, color: true } },
          _count: { select: { subTasks: true } },
        },
      },
    },
  })

  if (!client) notFound()

  // Récupérer aussi les tâches via les projets du client
  const projectTasks = await prisma.task.findMany({
    where: {
      project: { clientId: id, userId },
      isGroup: false,
      parentTaskId: null,
      clientId: null, // éviter les doublons
    },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      priority: true,
      importance: true,
      estimatedHours: true,
      dueDate: true,
      startedAt: true,
      completedAt: true,
      project: { select: { id: true, name: true } },
      taskTags: { select: { id: true, name: true, color: true } },
      _count: { select: { subTasks: true } },
    },
  })

  const allTasks = [...client.tasks, ...projectTasks]

  const totalBilled = client.invoices
    .filter((i) => i.status === "PAID")
    .reduce((s, i) => s + i.totalHT - i.depositDeducted, 0)

  const pendingAmount = client.invoices
    .filter((i) => i.status === "SENT" || i.status === "LATE")
    .reduce((s, i) => s + i.totalHT - i.depositDeducted, 0)

  const fmt = (d: Date | string) =>
    new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Colonne principale */}
      <div className="lg:col-span-2 space-y-6">

        {/* Fiche informations */}
        <ClientInfoCard client={{
          id: client.id,
          name: client.name,
          company: client.company,
          email: client.email,
          phone: client.phone,
          source: client.source,
          notes: client.notes,
          type: client.type,
          temperature: client.temperature,
          address: client.address ?? null,
          postalCode: client.postalCode ?? null,
          city: client.city ?? null,
          country: client.country ?? null,
          siret: client.siret ?? null,
        }} />

        {/* Tâches */}
        <ClientTasksSection
          clientId={id}
          tasks={allTasks as never}
        />

      </div>

      {/* Colonne droite */}
      <div className="space-y-6">

        {/* Projets */}
        {client.projects.length > 0 && (
          <div className="rounded-xl border border-border/50 bg-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderKanban className="h-4 w-4 text-muted-foreground" />
                <h2 className="font-semibold text-sm">Projets</h2>
              </div>
              <Link href={`/client/${id}/projets`} className="text-xs text-primary hover:underline">Voir tout</Link>
            </div>
            <div className="space-y-1.5">
              {client.projects.map((p) => (
                <Link key={p.id} href={`/projets/${p.id}`} className="flex items-center gap-2 text-sm hover:text-primary transition-colors">
                  <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${projectStatusDot[p.status] ?? "bg-muted-foreground"}`} />
                  {p.name}
                </Link>
              ))}
            </div>
          </div>
        )}

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
            {totalBilled > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Facturé (payé)</span>
                <span className="font-medium text-emerald-600">{totalBilled.toLocaleString("fr-FR")} €</span>
              </div>
            )}
            {pendingAmount > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">En attente</span>
                <span className="font-medium text-amber-600">{pendingAmount.toLocaleString("fr-FR")} €</span>
              </div>
            )}
          </div>
        </div>

        {/* Rappels */}
        {client.reminders.length > 0 && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-amber-600" />
                <h2 className="font-semibold text-sm text-amber-700 dark:text-amber-400">Rappels</h2>
              </div>
              <Link href={`/client/${id}/rappels`} className="text-xs text-primary hover:underline">Voir tout</Link>
            </div>
            <div className="space-y-2">
              {client.reminders.map((r) => (
                <div key={r.id} className="text-sm">
                  <p className={`font-medium ${new Date(r.dueDate) < new Date() ? "text-red-500" : "text-amber-600"}`}>
                    {fmt(r.dueDate)}
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <h2 className="font-semibold text-sm">Dernières interactions</h2>
              </div>
              <Link href={`/client/${id}/interactions`} className="text-xs text-primary hover:underline">Voir tout</Link>
            </div>
            <div className="space-y-2">
              {client.interactions.map((i) => (
                <div key={i.id} className="border-l-2 border-border pl-3">
                  <p className="text-xs text-muted-foreground">
                    {channelLabels[i.channel] ?? i.channel} · {fmt(i.date)}
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
            redirect("/client")
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
