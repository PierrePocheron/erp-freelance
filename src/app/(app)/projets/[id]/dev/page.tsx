import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { TaskItem } from "@/components/modules/projet/TaskItem"
import { AddTaskForm } from "@/components/modules/projet/AddTaskForm"
import {
  createMilestone,
  updateMilestoneStatus,
  createUsefulLink,
  deleteUsefulLink,
  createJournalEntry,
  createDeliverable,
  updateDeliverableStatus,
} from "@/actions/projet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  CheckSquare, Flag, Link2, BookOpen, Package,
  ExternalLink, Trash2, CheckCircle2, Circle, Clock
} from "lucide-react"

const milestoneColors = {
  UPCOMING: "bg-muted text-muted-foreground border-border",
  IN_PROGRESS: "bg-amber-500/15 text-amber-600 border-amber-500/20",
  DONE: "bg-emerald-500/15 text-emerald-600 border-emerald-500/20",
}
const milestoneLabels = { UPCOMING: "À venir", IN_PROGRESS: "En cours", DONE: "Terminé" }

const linkCategories = [
  { value: "GITHUB", label: "GitHub" },
  { value: "LOCAL", label: "Local" },
  { value: "PROD", label: "Prod" },
  { value: "STAGING", label: "Staging" },
  { value: "DOCS", label: "Docs" },
  { value: "OTHER", label: "Autre" },
]

export default async function ProjectDevPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await auth()
  const userId = session!.user.id

  const project = await prisma.project.findFirst({
    where: { id, userId },
    include: {
      tasks: {
        where: { parentTaskId: null },
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        include: {
          subTasks: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] },
          timeEntries: {
            where: { userId },
            select: { id: true, startedAt: true, endedAt: true, duration: true },
          },
        },
      },
      milestones: { orderBy: { date: "asc" } },
      usefulLinks: { orderBy: { createdAt: "asc" } },
      journalEntries: { orderBy: { createdAt: "desc" } },
      deliverables: { orderBy: { createdAt: "asc" } },
    },
  })

  if (!project) notFound()

  const todo = project.tasks.filter((t) => t.status === "TODO")
  const inProgress = project.tasks.filter((t) => t.status === "IN_PROGRESS")
  const done = project.tasks.filter((t) => t.status === "DONE")

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

      {/* Colonne principale : Tâches + Jalons + Livrables */}
      <div className="lg:col-span-2 space-y-6">

        {/* Tâches */}
        <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold">Tâches</h2>
            <span className="ml-auto text-xs text-muted-foreground">
              {done.length}/{project.tasks.length} terminées
            </span>
          </div>

          {inProgress.length > 0 && (
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">En cours</p>
              {inProgress.map((t, i) => <TaskItem key={t.id} task={t} projectId={id} userId={userId} isFirst={i === 0} isLast={i === inProgress.length - 1} />)}
            </div>
          )}

          {todo.length > 0 && (
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">À faire</p>
              {todo.map((t, i) => <TaskItem key={t.id} task={t} projectId={id} userId={userId} isFirst={i === 0} isLast={i === todo.length - 1} />)}
            </div>
          )}

          {done.length > 0 && (
            <div className="space-y-0.5 opacity-70">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">Terminées</p>
              {done.map((t, i) => <TaskItem key={t.id} task={t} projectId={id} userId={userId} isFirst={i === 0} isLast={i === done.length - 1} />)}
            </div>
          )}

          <AddTaskForm projectId={id} />
        </div>

        {/* Jalons */}
        <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Flag className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold">Jalons</h2>
          </div>

          {project.milestones.length > 0 && (
            <div className="space-y-2">
              {project.milestones.map((m) => (
                <div key={m.id} className="flex items-center gap-3 py-1.5">
                  <form action={async () => {
                    "use server"
                    const next = m.status === "UPCOMING" ? "IN_PROGRESS" : m.status === "IN_PROGRESS" ? "DONE" : "UPCOMING"
                    await updateMilestoneStatus(m.id, id, next)
                  }}>
                    <button type="submit" className="text-muted-foreground hover:text-primary transition-colors">
                      {m.status === "DONE"
                        ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        : <Circle className="h-4 w-4" />}
                    </button>
                  </form>
                  <span className="flex-1 text-sm">{m.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(m.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                  </span>
                  <Badge variant="outline" className={`text-xs ${milestoneColors[m.status]}`}>
                    {milestoneLabels[m.status]}
                  </Badge>
                </div>
              ))}
            </div>
          )}

          <form action={async (fd: FormData) => {
            "use server"
            await createMilestone(id, fd)
          }} className="flex gap-2">
            <Input name="name" placeholder="Nom du jalon" className="h-8 text-sm" required />
            <Input name="date" type="date" className="h-8 text-sm w-36" required />
            <Button type="submit" size="sm" variant="outline">Ajouter</Button>
          </form>
        </div>

        {/* Livrables */}
        <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold">Livrables</h2>
          </div>

          {project.deliverables.length > 0 && (
            <div className="space-y-2">
              {project.deliverables.map((d) => (
                <div key={d.id} className="flex items-center gap-3 py-1">
                  <form action={async () => {
                    "use server"
                    const next = d.status === "TO_DELIVER" ? "DELIVERED" : d.status === "DELIVERED" ? "VALIDATED" : "TO_DELIVER"
                    await updateDeliverableStatus(d.id, id, next)
                  }}>
                    <button type="submit" className="text-muted-foreground hover:text-primary">
                      {d.status === "VALIDATED"
                        ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        : d.status === "DELIVERED"
                        ? <Clock className="h-4 w-4 text-amber-500" />
                        : <Circle className="h-4 w-4" />}
                    </button>
                  </form>
                  <span className="flex-1 text-sm">{d.name}</span>
                  <Badge variant="outline" className="text-xs">
                    {d.status === "TO_DELIVER" ? "À livrer" : d.status === "DELIVERED" ? "Livré" : "Validé"}
                  </Badge>
                </div>
              ))}
            </div>
          )}

          <form action={async (fd: FormData) => {
            "use server"
            await createDeliverable(id, fd)
          }} className="flex gap-2">
            <Input name="name" placeholder="Nom du livrable" className="h-8 text-sm" required />
            <Button type="submit" size="sm" variant="outline">Ajouter</Button>
          </form>
        </div>
      </div>

      {/* Colonne secondaire : Liens utiles + Journal */}
      <div className="space-y-6">

        {/* Liens utiles */}
        <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold">Liens utiles</h2>
          </div>

          {project.usefulLinks.length > 0 && (
            <div className="space-y-2">
              {project.usefulLinks.map((l) => (
                <div key={l.id} className="flex items-center gap-2 group">
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center gap-1.5 text-sm hover:text-primary transition-colors"
                  >
                    <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                    <span className="truncate">{l.label}</span>
                    <Badge variant="outline" className="text-xs ml-auto shrink-0">
                      {l.category}
                    </Badge>
                  </a>
                  <form action={async () => {
                    "use server"
                    await deleteUsefulLink(l.id, id)
                  }}>
                    <button type="submit" className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}

          <form action={async (fd: FormData) => {
            "use server"
            await createUsefulLink(id, fd)
          }} className="space-y-2">
            <Input name="label" placeholder="Label (ex: GitHub repo)" className="h-8 text-sm" required />
            <Input name="url" placeholder="https://..." className="h-8 text-sm" required />
            <select
              name="category"
              className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            >
              {linkCategories.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <Button type="submit" size="sm" variant="outline" className="w-full">Ajouter</Button>
          </form>
        </div>

        {/* Journal */}
        <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold">Journal de bord</h2>
          </div>

          <form action={async (fd: FormData) => {
            "use server"
            await createJournalEntry(id, fd)
          }} className="space-y-2">
            <textarea
              name="content"
              rows={3}
              placeholder="Note, décision technique, retour client..."
              required
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            />
            <Button type="submit" size="sm" variant="outline" className="w-full">Ajouter une note</Button>
          </form>

          {project.journalEntries.length > 0 && (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {project.journalEntries.map((e) => (
                <div key={e.id} className="border-l-2 border-border pl-3">
                  <p className="text-xs text-muted-foreground mb-0.5">
                    {new Date(e.createdAt).toLocaleDateString("fr-FR", {
                      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                    })}
                  </p>
                  <p className="text-sm whitespace-pre-line">{e.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
