import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session) return new Response("Unauthorized", { status: 401 })

  const userId = session.user.id

  const quotes = await prisma.quote.findMany({
    where: { userId },
    include: {
      client: { select: { name: true, company: true } },
      project: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  const statusLabels: Record<string, string> = {
    DRAFT: "Brouillon",
    VALIDATED: "Validé",
    SENT: "Envoyé",
    WAITING_DEPOSIT: "Attente acompte",
    DEPOSIT_RECEIVED: "Acompte reçu",
    ACCEPTED: "Accepté",
    IN_PROGRESS: "En cours",
    SIGNED: "Signé",
    REJECTED: "Refusé",
  }

  const header = ["Numéro", "Statut", "Client", "Société", "Projet", "Total HT (€)", "Acompte (%)", "Date création", "Date envoi", "Date acceptation"]
  const rows = quotes.map((q) => [
    q.number,
    statusLabels[q.status] ?? q.status,
    q.client.name,
    q.client.company ?? "",
    q.project?.name ?? "",
    q.totalHT.toFixed(2),
    q.depositPercent.toString(),
    new Date(q.createdAt).toLocaleDateString("fr-FR"),
    q.sentAt ? new Date(q.sentAt).toLocaleDateString("fr-FR") : "",
    q.acceptedAt ? new Date(q.acceptedAt).toLocaleDateString("fr-FR") : "",
  ])

  const csv = [header, ...rows]
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";"))
    .join("\n")

  return new Response("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="devis-export.csv"`,
    },
  })
}
