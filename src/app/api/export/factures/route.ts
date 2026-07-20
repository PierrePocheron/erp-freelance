import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextRequest } from "next/server"
import type { InvoiceStatus } from "@/generated/prisma/enums"

const VALID_STATUSES: InvoiceStatus[] = ["DRAFT", "ISSUED", "SENT", "PAID", "LATE", "CANCELLED"]

/** Même sémantique de mois que la liste des factures : encaissement (paidAt),
 *  sinon date d'émission, en dernier recours date de création. */
function invoiceMonthKey(inv: { paidAt: Date | null; issuedAt: Date | null; createdAt: Date }): string {
  const d = new Date(inv.paidAt ?? inv.issuedAt ?? inv.createdAt)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return new Response("Unauthorized", { status: 401 })

  const userId = session.user.id
  const { searchParams } = req.nextUrl
  const statusParam = searchParams.get("status")
  const status = statusParam && VALID_STATUSES.includes(statusParam as InvoiceStatus)
    ? (statusParam as InvoiceStatus)
    : undefined

  // Filtres alignés sur ceux de la liste (?projet= ?client= ?societe= ?mois= ?q=)
  // pour que « Exporter en CSV » exporte exactement ce que le tableau affiche.
  const projet = searchParams.get("projet")
  const clientId = searchParams.get("client")
  const societe = searchParams.get("societe")
  const mois = searchParams.get("mois")?.split(",").filter(Boolean) ?? []
  const q = searchParams.get("q")?.trim().toLowerCase() ?? ""

  const invoices = await prisma.invoice.findMany({
    where: {
      userId,
      ...(status ? { status } : {}),
      ...(projet ? { projectId: projet } : {}),
      ...(clientId ? { clientId } : {}),
      ...(societe
        ? { OR: [{ client: { companyId: societe } }, { project: { companyId: societe } }] }
        : {}),
    },
    include: {
      client: { select: { name: true, company: true } },
      project: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  const filtered = invoices.filter((inv) => {
    if (mois.length > 0 && !mois.includes(invoiceMonthKey(inv))) return false
    if (q) {
      const haystack = [inv.number, inv.client.name, inv.client.company ?? "", inv.project?.name ?? ""]
        .join(" ")
        .toLowerCase()
      if (!haystack.includes(q)) return false
    }
    return true
  })

  const typeLabels: Record<string, string> = {
    DEPOSIT: "Acompte", FINAL: "Solde", RECURRING: "Récurrent", STANDALONE: "Standard",
  }
  const statusLabels: Record<string, string> = {
    DRAFT: "Brouillon", ISSUED: "Émise", SENT: "Envoyée", PAID: "Payée", LATE: "En retard", CANCELLED: "Annulée",
  }

  const rows: string[] = [
    "Numéro;Client;Projet;Type;Statut;Total HT;Acompte déduit;Net à payer;Échéance;Date création",
  ]

  for (const inv of filtered) {
    const client = inv.client.company ?? inv.client.name
    const project = inv.project?.name ?? ""
    const net = inv.totalHT - inv.depositDeducted
    const dueDate = inv.dueDate ? new Date(inv.dueDate).toLocaleDateString("fr-FR") : ""
    const createdAt = new Date(inv.createdAt).toLocaleDateString("fr-FR")
    rows.push([
      inv.number,
      client.replace(/;/g, ","),
      project.replace(/;/g, ","),
      typeLabels[inv.type] ?? inv.type,
      statusLabels[inv.status] ?? inv.status,
      inv.totalHT.toFixed(2).replace(".", ","),
      inv.depositDeducted.toFixed(2).replace(".", ","),
      net.toFixed(2).replace(".", ","),
      dueDate,
      createdAt,
    ].join(";"))
  }

  const csv = rows.join("\n")
  const now = new Date().toISOString().split("T")[0]

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="factures-${now}.csv"`,
    },
  })
}
