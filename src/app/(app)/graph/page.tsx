import { auth }    from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma }   from "@/lib/prisma"
import { GraphView } from "@/components/modules/graph/GraphView"
import type { RawNode, RawLink } from "@/components/modules/graph/graph-types"

export default async function GraphPage() {
  const session = await auth()
  if (!session) redirect("/login")
  const userId = session.user.id

  const [companies, clients, projects, invoices, quotes] = await Promise.all([
    prisma.company.findMany({
      where: { userId },
      select: { id: true, name: true, city: true, website: true },
    }),
    prisma.client.findMany({
      where: { userId },
      select: { id: true, name: true, type: true, companyId: true, email: true, city: true, phone: true },
    }),
    prisma.project.findMany({
      where: { userId },
      select: { id: true, name: true, status: true, clientId: true, companyId: true, startDate: true, endDate: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.invoice.findMany({
      where: { userId },
      select: { id: true, number: true, status: true, totalHT: true, clientId: true, projectId: true, paidAt: true, issuedAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.quote.findMany({
      where: { userId },
      select: { id: true, number: true, status: true, totalHT: true, clientId: true, projectId: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
  ])

  const nodes: RawNode[] = []
  const links: RawLink[] = []

  // ── Companies ────────────────────────────────────────────────────────────
  for (const c of companies) {
    const contactCount  = clients.filter(cl => cl.companyId === c.id && cl.type !== "SELF").length
    const projectCount  = projects.filter(p => p.companyId === c.id).length
    nodes.push({
      id:       `company-${c.id}`,
      type:     "COMPANY",
      label:    c.name,
      parentId: null,
      meta: {
        href:     `/societes/${c.id}`,
        subtitle: [c.city, c.website].filter(Boolean).join(" · "),
        details: [
          { label: "Contacts",  value: String(contactCount)  },
          { label: "Projets",   value: String(projectCount)  },
          ...(c.website ? [{ label: "Site", value: c.website }] : []),
        ],
      },
    })
  }

  // ── Clients (contacts) ────────────────────────────────────────────────────
  for (const c of clients) {
    if (c.type === "SELF") continue
    const nodeId   = `client-${c.id}`
    const parentId = c.companyId ? `company-${c.companyId}` : null
    const projCount = projects.filter(p => p.clientId === c.id).length
    nodes.push({
      id:       nodeId,
      type:     "CLIENT",
      label:    c.name,
      parentId,
      meta: {
        href:     `/client/${c.id}`,
        subtitle: c.email ?? c.city ?? undefined,
        details: [
          { label: "Projets", value: String(projCount) },
          ...(c.email ? [{ label: "Email", value: c.email }] : []),
          ...(c.phone ? [{ label: "Tél",   value: c.phone }] : []),
        ],
      },
    })
    if (parentId) links.push({ source: parentId, target: nodeId })
  }

  // ── Projects ──────────────────────────────────────────────────────────────
  for (const p of projects) {
    const nodeId   = `project-${p.id}`
    const parentId = p.clientId
      ? `client-${p.clientId}`
      : p.companyId
      ? `company-${p.companyId}`
      : null
    const invCount = invoices.filter(i => i.projectId === p.id).length
    const qCount   = quotes.filter(q => q.projectId === p.id).length
    nodes.push({
      id:       nodeId,
      type:     "PROJECT",
      label:    p.name,
      parentId,
      status:   p.status,
      meta: {
        href:     `/projets/${p.id}`,
        subtitle: p.status,
        details: [
          { label: "Statut",   value: PROJECT_STATUS_LABELS[p.status] ?? p.status },
          { label: "Factures", value: String(invCount) },
          { label: "Devis",    value: String(qCount)   },
          ...(p.startDate ? [{ label: "Début", value: new Date(p.startDate).toLocaleDateString("fr-FR") }] : []),
        ],
      },
    })
    if (parentId) links.push({ source: parentId, target: nodeId })
  }

  // ── Invoices ──────────────────────────────────────────────────────────────
  for (const inv of invoices) {
    const nodeId   = `invoice-${inv.id}`
    const parentId = inv.projectId
      ? `project-${inv.projectId}`
      : `client-${inv.clientId}`
    nodes.push({
      id:       nodeId,
      type:     "INVOICE",
      label:    inv.number,
      parentId,
      status:   inv.status,
      amount:   inv.totalHT,
      meta: {
        href:     `/facturation/factures/${inv.id}`,
        subtitle: `${inv.totalHT.toLocaleString("fr-FR")} € HT`,
        details: [
          { label: "Statut",  value: INVOICE_STATUS_LABELS[inv.status] ?? inv.status },
          { label: "Montant", value: `${inv.totalHT.toLocaleString("fr-FR")} € HT` },
          ...(inv.paidAt ? [{ label: "Payée le", value: new Date(inv.paidAt).toLocaleDateString("fr-FR") }] : []),
        ],
      },
    })
    links.push({ source: parentId, target: nodeId })
  }

  // ── Quotes ────────────────────────────────────────────────────────────────
  for (const q of quotes) {
    const nodeId   = `quote-${q.id}`
    const parentId = q.projectId
      ? `project-${q.projectId}`
      : `client-${q.clientId}`
    nodes.push({
      id:       nodeId,
      type:     "QUOTE",
      label:    q.number,
      parentId,
      status:   q.status,
      amount:   q.totalHT,
      meta: {
        href:     `/facturation/devis/${q.id}`,
        subtitle: `${q.totalHT.toLocaleString("fr-FR")} € HT`,
        details: [
          { label: "Statut",  value: QUOTE_STATUS_LABELS[q.status] ?? q.status },
          { label: "Montant", value: `${q.totalHT.toLocaleString("fr-FR")} € HT` },
        ],
      },
    })
    links.push({ source: parentId, target: nodeId })
  }

  return (
    <div className="h-[calc(100vh-3rem)] -m-6 overflow-hidden">
      <GraphView rawNodes={nodes} rawLinks={links} />
    </div>
  )
}

const PROJECT_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "En cours", COMPLETED: "Terminé", PAUSED: "En pause", CANCELLED: "Annulé",
}
const INVOICE_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Brouillon", ISSUED: "Émise", SENT: "Envoyée", PAID: "Payée", LATE: "En retard", CANCELLED: "Annulée",
}
const QUOTE_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Brouillon", VALIDATED: "Validé", SENT: "Envoyé", ACCEPTED: "Accepté",
  IN_PROGRESS: "En cours", SIGNED: "Signé", REJECTED: "Refusé",
}
