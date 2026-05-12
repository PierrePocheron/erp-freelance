import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextRequest } from "next/server"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await auth()
  if (!session) return new Response("Unauthorized", { status: 401 })

  const { projectId } = await params
  const userId = session.user.id

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    include: {
      tasks: {
        include: {
          timeEntries: {
            where: { userId, endedAt: { not: null } },
            orderBy: { startedAt: "asc" },
          },
        },
      },
    },
  })

  if (!project) return new Response("Not found", { status: 404 })

  const rows: string[] = [
    "Tâche;Date;Début;Fin;Durée (min);Durée (h)",
  ]

  for (const task of project.tasks) {
    for (const entry of task.timeEntries) {
      if (!entry.endedAt || !entry.duration) continue
      const date = new Date(entry.startedAt).toLocaleDateString("fr-FR")
      const start = new Date(entry.startedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
      const end = new Date(entry.endedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
      const durationMin = Math.round(entry.duration / 60)
      const durationH = (entry.duration / 3600).toFixed(2).replace(".", ",")
      const title = task.title.replace(/;/g, ",")
      rows.push(`${title};${date};${start};${end};${durationMin};${durationH}`)
    }
  }

  const csv = rows.join("\n")
  const filename = `temps-${project.name.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.csv`

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
