import { auth }    from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma }   from "@/lib/prisma"
import { GraphView } from "@/components/modules/graph/GraphView"
import type { RawNode, RawLink } from "@/components/modules/graph/graph-types"

export default async function GraphPage() {
  const session = await auth()
  if (!session) redirect("/login")
  const userId = session.user.id

  const [companies, clients, projects, invoices, quotes, fiscalSources, revenues] = await Promise.all([
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
      select: { id: true, number: true, status: true, totalHT: true, clientId: true, projectId: true, paidAt: true, issuedAt: true, emitterProfileId: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.quote.findMany({
      where: { userId },
      select: { id: true, number: true, status: true, totalHT: true, clientId: true, projectId: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.fiscalSource.findMany({
      where: { userId, isActive: true },
      select: {
        id: true,
        name: true,
        bucket: true,
        color: true,
        emitterProfiles: { select: { id: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.revenue.findMany({
      where: { userId },
      select: {
        id: true, label: true, amount: true, status: true,
        fiscalSourceId: true, projectId: true, companyId: true, clientId: true,
        receivedAt: true, expectedAt: true,
      },
      orderBy: { receivedAt: "asc" },
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
        href:     `/contacts/${c.id}`,
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

  // IDs des clients de type SELF — leurs projets remontent à la société parente
  const selfClientIds = new Set(clients.filter(c => c.type === "SELF").map(c => c.id))

  // ── Projects ──────────────────────────────────────────────────────────────
  for (const p of projects) {
    const nodeId   = `project-${p.id}`
    const parentId = (p.clientId && !selfClientIds.has(p.clientId))
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

  // ── Revenues ──────────────────────────────────────────────────────────────
  // Ensemble des IDs déjà créés — pour vérifier que le parent d'un revenu existe.
  const nodeIds = new Set(nodes.map(n => n.id))

  for (const rev of revenues) {
    const revNodeId = `revenue-${rev.id}`

    // Cherche le premier ancêtre valide : project → company → client
    const rawParent = rev.projectId
      ? `project-${rev.projectId}`
      : rev.companyId
      ? `company-${rev.companyId}`
      : rev.clientId && !selfClientIds.has(rev.clientId)
      ? `client-${rev.clientId}`
      : null

    const parentId = rawParent && nodeIds.has(rawParent) ? rawParent : null

    const date    = rev.receivedAt ?? rev.expectedAt
    const dateStr = date ? new Date(date).toLocaleDateString("fr-FR") : "—"

    nodes.push({
      id:       revNodeId,
      type:     "REVENUE",
      label:    rev.label,
      parentId,
      status:   rev.status ?? undefined,
      amount:   rev.amount,
      meta: {
        subtitle: `${rev.amount.toLocaleString("fr-FR")} €`,
        details: [
          { label: "Montant", value: `${rev.amount.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €` },
          { label: "Statut",  value: rev.status === "RECEIVED" ? "Reçu" : "En attente" },
          { label: "Date",    value: dateStr },
        ],
      },
    })
    if (parentId) links.push({ source: parentId, target: revNodeId })
  }

  // ── Fiscal Sources ─────────────────────────────────────────────────────────
  // Un nœud SOURCE par source fiscale active ; lié aux sociétés / contacts
  // dont les factures ont été émises avec un profil émetteur rattaché à cette source.
  for (const src of fiscalSources) {
    const srcNodeId  = `source-${src.id}`
    const emitterIds = new Set(src.emitterProfiles.map(e => e.id))

    // Clients dont au moins une facture provient de cette source
    const linkedClientIds = new Set(
      invoices
        .filter(inv => inv.emitterProfileId && emitterIds.has(inv.emitterProfileId))
        .map(inv => inv.clientId)
        .filter((id): id is string => id !== null)
    )

    // Depuis ces clients : sociétés (lien SOURCE→COMPANY) ou contacts seuls (SOURCE→CLIENT)
    const linkedCompanyIds   = new Set<string>()
    const standaloneClientIds = new Set<string>()

    for (const clientId of linkedClientIds) {
      const client = clients.find(c => c.id === clientId)
      if (!client || client.type === "SELF") continue
      if (client.companyId) {
        linkedCompanyIds.add(client.companyId)
      } else {
        standaloneClientIds.add(clientId)
      }
    }

    // Liens depuis les Revenue entries (études, baby-sitting, CAF…)
    for (const rev of revenues) {
      if (rev.fiscalSourceId !== src.id) continue
      if (rev.companyId) {
        linkedCompanyIds.add(rev.companyId)
      } else if (rev.clientId) {
        const client = clients.find(c => c.id === rev.clientId)
        if (client?.companyId) {
          linkedCompanyIds.add(client.companyId)
        } else if (client && client.type !== "SELF") {
          standaloneClientIds.add(rev.clientId)
        }
      }
    }

    const totalLinked = linkedCompanyIds.size + standaloneClientIds.size

    nodes.push({
      id:       srcNodeId,
      type:     "SOURCE",
      label:    src.name,
      parentId: null,
      meta: {
        color:    src.color,
        subtitle: SOURCE_BUCKET_LABELS[src.bucket] ?? src.bucket,
        details: [
          { label: "Catégorie",        value: SOURCE_BUCKET_LABELS[src.bucket] ?? src.bucket },
          { label: "Sociétés/Contacts", value: String(totalLinked) },
        ],
      },
    })

    for (const companyId of linkedCompanyIds) {
      links.push({ source: srcNodeId, target: `company-${companyId}` })
    }
    for (const clientId of standaloneClientIds) {
      links.push({ source: srcNodeId, target: `client-${clientId}` })
    }
  }

  return (
    <div className="h-screen -m-6 overflow-hidden">
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
const SOURCE_BUCKET_LABELS: Record<string, string> = {
  AE_URSSAF:     "AE — Déclaré URSSAF",
  NON_IMPOSABLE: "Non imposable",
  OTHER:         "Autre",
}
