import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { notFound, redirect } from "next/navigation"
import { TaskShortcut } from "@/components/modules/projet/TaskShortcut"
import { DevTaskBoard } from "@/components/modules/projet/DevTaskBoard"
import { TagManager } from "@/components/modules/projet/TagManager"
import {
  createJournalEntry,
  createDeliverable,
  updateDeliverableStatus,
  migrateGroupsToTags,
} from "@/actions/projet"
import { MilestoneDialog, MILESTONE_TYPE_LABELS, MILESTONE_TYPE_COLORS } from "@/components/modules/projet/MilestoneDialog"
import { MilestoneToggle } from "@/components/modules/projet/MilestoneToggle"
import { UsefulLinkDialog } from "@/components/modules/projet/UsefulLinkDialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  CheckSquare, Flag, Link2, BookOpen, Package,
  ExternalLink, CheckCircle2, Circle, Clock,
} from "lucide-react"
import { LINK_CATEGORY_CONFIG, normalizeUrl } from "@/lib/link-categories"
import { type TaskShape } from "@/components/modules/projet/TaskItem"

const milestoneColors = {
  UPCOMING: "bg-muted text-muted-foreground border-border",
  IN_PROGRESS: "bg-amber-500/15 text-amber-600 border-amber-500/20",
  DONE: "bg-emerald-500/15 text-emerald-600 border-emerald-500/20",
  CANCELLED: "bg-red-500/15 text-red-600 border-red-500/20",
}
const milestoneLabels = { UPCOMING: "À venir", IN_PROGRESS: "En cours", DONE: "Terminé", CANCELLED: "Annulé" }

function fmtTime(d: Date | string) {
  return new Date(d).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
}
function hasTime(d: Date | string) {
  const dt = new Date(d)
  return dt.getHours() !== 0 || dt.getMinutes() !== 0
}

export default async function ProjectDevPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await auth()
  const userId = session!.user.id

  // Migration one-shot : si des anciennes tâches-groupe existent, les convertir en tags
  const hasGroups = await prisma.task.count({ where: { projectId: id, isGroup: true } })
  if (hasGroups > 0) {
    await migrateGroupsToTags(id)
    redirect(`/projets/${id}/dev`)
  }

  const project = await prisma.project.findFirst({
    where: { id, userId },
    include: {
      tasks: {
        where: { parentTaskId: null, isGroup: false },
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        include: {
          taskTags: { select: { id: true, name: true, color: true } },
          subTasks: {
            orderBy: [{ order: "asc" }, { createdAt: "asc" }],
            include: {
              taskTags: { select: { id: true, name: true, color: true } },
              subTasks: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] },
              timeEntries: {
                where: { userId },
                select: { id: true, startedAt: true, endedAt: true, duration: true },
              },
            },
          },
          timeEntries: {
            where: { userId },
            select: { id: true, startedAt: true, endedAt: true, duration: true },
          },
        },
      },
      taskTags: { orderBy: { createdAt: "asc" } },
      milestones: { orderBy: { date: "asc" } },
      usefulLinks: { orderBy: { createdAt: "asc" } },
      journalEntries: { orderBy: { createdAt: "desc" } },
      deliverables: { orderBy: { createdAt: "asc" } },
    },
  })

  if (!project) notFound()

  const tasks = project.tasks as unknown as TaskShape[]
  const projectTags = project.taskTags

  const totalTasks = tasks.length
  const doneTasks = tasks.filter((t) => t.status === "DONE").length

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <TaskShortcut />

      {/* Colonne principale */}
      <div className="lg:col-span-2 space-y-4">

        {/* En-tête tâches */}
        <div className="flex items-center gap-3 flex-wrap">
          <CheckSquare className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold">Tâches</h2>
          <span className="text-xs text-muted-foreground">{doneTasks}/{totalTasks} terminées</span>
          <div className="flex-1" />
          <span className="text-xs text-muted-foreground hidden sm:inline">
            <kbd className="bg-muted border border-border px-1 py-0.5 rounded font-mono text-[10px]">⌘↵</kbd> nouvelle tâche
          </span>
        </div>

        {/* Gestion des tags */}
        <TagManager projectId={id} initialTags={projectTags} />

        {/* Board DnD filtré par tags */}
        <DevTaskBoard
          initialTasks={tasks}
          projectId={id}
          userId={userId}
          projectTags={projectTags}
        />

        {/* Jalons */}
        <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Flag className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold">Jalons</h2>
          </div>

          {project.milestones.length > 0 && (
            <div className="space-y-2">
              {project.milestones.map((m) => (
                <div key={m.id} className="flex items-center gap-3 py-1.5 group">
                  <MilestoneToggle milestoneId={m.id} projectId={id} status={m.status} />
                  <span className="flex-1 text-sm min-w-0 truncate">{m.name}</span>
                  <Badge variant="outline" className={`text-xs shrink-0 ${MILESTONE_TYPE_COLORS[m.type] ?? MILESTONE_TYPE_COLORS.OTHER}`}>
                    {MILESTONE_TYPE_LABELS[m.type] ?? m.type}
                  </Badge>
                  <span className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">
                    {new Date(m.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                    {hasTime(m.date) && ` · ${fmtTime(m.date)}`}
                    {m.endDate && ` – ${fmtTime(m.endDate)}`}
                  </span>
                  <Badge variant="outline" className={`text-xs shrink-0 ${milestoneColors[m.status]}`}>{milestoneLabels[m.status]}</Badge>
                  <MilestoneDialog projectId={id} milestone={m} />
                </div>
              ))}
            </div>
          )}

          <MilestoneDialog projectId={id} />
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
                      {d.status === "VALIDATED" ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : d.status === "DELIVERED" ? <Clock className="h-4 w-4 text-amber-500" /> : <Circle className="h-4 w-4" />}
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

          <form action={async (fd: FormData) => { "use server"; await createDeliverable(id, fd) }} className="flex gap-2">
            <Input name="name" placeholder="Nom du livrable" className="h-8 text-sm" required />
            <Button type="submit" size="sm" variant="outline">Ajouter</Button>
          </form>
        </div>
      </div>

      {/* Colonne secondaire */}
      <div className="space-y-6">

        {/* Liens utiles */}
        <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold">Liens utiles</h2>
          </div>

          {project.usefulLinks.length > 0 && (
            <div className="space-y-2">
              {project.usefulLinks.map((l) => {
                const cat = LINK_CATEGORY_CONFIG[l.category] ?? LINK_CATEGORY_CONFIG.OTHER
                return (
                  <div key={l.id} className="flex items-center gap-2 group">
                    <a href={normalizeUrl(l.url)} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center gap-1.5 text-sm hover:text-primary transition-colors min-w-0">
                      <span className={`h-2 w-2 rounded-full shrink-0 ${cat.dot}`} />
                      <span className="truncate">{l.label}</span>
                      <Badge variant="outline" className={`text-xs ml-auto shrink-0 ${cat.cls}`}>{cat.label}</Badge>
                      <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                    </a>
                    <UsefulLinkDialog projectId={id} link={l} />
                  </div>
                )
              })}
            </div>
          )}

          <UsefulLinkDialog projectId={id} />
        </div>

        {/* Journal */}
        <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold">Journal de bord</h2>
          </div>

          <form action={async (fd: FormData) => { "use server"; await createJournalEntry(id, fd) }} className="space-y-2">
            <textarea name="content" rows={3} placeholder="Note, décision technique, retour client..." required className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none" />
            <Button type="submit" size="sm" variant="outline" className="w-full">Ajouter une note</Button>
          </form>

          {project.journalEntries.length > 0 && (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {project.journalEntries.map((e) => (
                <div key={e.id} className="border-l-2 border-border pl-3">
                  <p className="text-xs text-muted-foreground mb-0.5">
                    {new Date(e.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
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
