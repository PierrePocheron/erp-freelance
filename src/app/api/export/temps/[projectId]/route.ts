import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextRequest } from "next/server"

/** Échappe une valeur pour une cellule CSV : guillemets + doublage des `"` afin
 *  que `;`, retours à la ligne et guillemets internes ne cassent pas la structure.
 *  `guard` neutralise en plus l'injection de formule (`= + - @`) sur le texte libre. */
function csvCell(value: string, guard = false): string {
  const safe = guard && /^[=+\-@]/.test(value) ? `'${value}` : value
  return `"${safe.replace(/"/g, '""')}"`
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 })

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
    ["Tâche", "Date", "Début", "Fin", "Durée (min)", "Durée (h)"].map((h) => csvCell(h)).join(";"),
  ]

  for (const task of project.tasks) {
    for (const entry of task.timeEntries) {
      if (!entry.endedAt || !entry.duration) continue
      const date = new Date(entry.startedAt).toLocaleDateString("fr-FR")
      const start = new Date(entry.startedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
      const end = new Date(entry.endedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
      const durationMin = Math.round(entry.duration / 60)
      const durationH = (entry.duration / 3600).toFixed(2).replace(".", ",")
      rows.push([
        csvCell(task.title, true),
        csvCell(date),
        csvCell(start),
        csvCell(end),
        csvCell(String(durationMin)),
        csvCell(durationH),
      ].join(";"))
    }
  }

  // BOM UTF-8 en tête pour qu'Excel (Windows) affiche correctement les accents.
  const csv = "﻿" + rows.join("\n")
  const filename = `temps-${project.name.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.csv`

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
