import { auth }    from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma }   from "@/lib/prisma"
import { GraphView } from "@/components/modules/graph/GraphView"
import type { RawNode, RawLink } from "@/components/modules/graph/graph-types"
import { isContactIncomplete } from "@/lib/contact"

export default async function GraphPage() {
  const session = await auth()
  if (!session) redirect("/login")
  const userId = session.user.id

  const [companies, clients, projects, projectContactLinks, invoices, quotes, fiscalSources, revenues, applications] = await Promise.all([
    prisma.company.findMany({
      where: { userId },
      select: { id: true, name: true, city: true, website: true },
    }),
    prisma.client.findMany({
      where: { userId },
      select: { id: true, name: true, type: true, companyId: true, email: true, city: true, phone: true, firstName: true, lastName: true },
    }),
    prisma.project.findMany({
      where: { userId },
      select: { id: true, name: true, status: true, clientId: true, companyId: true, startDate: true, endDate: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.projectContact.findMany({
      where: { project: { userId } },
      select: { projectId: true, clientId: true, role: true },
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
    prisma.jobApplication.findMany({
      where: { userId },
      select: {
        id: true, companyName: true, position: true, status: true,
        companyId: true, contactId: true, salaryMin: true, salaryMax: true,
      },
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
      id:         `company-${c.id}`,
      type:       "COMPANY",
      label:      c.name,
      parentId:   null,
      incomplete: !c.website,
      meta: {
        href:     `/societes/${c.id}`,
        subtitle: [c.city, c.website].filter(Boolean).join(" · "),
        details: [
          { label: "Contacts",  value: String(contactCount)  },
          { label: "Projets",   value: String(projectCount)  },
          ...(c.website ? [{ label: "Site", value: c.website }] : [{ label: "Site", value: "— manquant" }]),
        ],
      },
    })
  }

  // ── Hubs Prospection & Perso ──────────────────────────────────────────────
  // Les prospects (≈230) et les proches n'ont ni société ni parent naturel :
  // sans hub, ce sont autant de nœuds orphelins qui flottent dans le graphe.
  const prospectCount = clients.filter(c => c.type === "PROSPECT").length
  const personalCount = clients.filter(c => c.type === "PERSONAL").length

  if (prospectCount > 0) {
    nodes.push({
      id:       "hub-prospection",
      type:     "SOURCE",
      label:    "Prospection",
      parentId: null,
      // Replié au chargement : un seul nœud central au lieu de ~230 enfants
      defaultCollapsed: true,
      meta: {
        href:     "/prospection",
        color:    "#fb7185", // rose — identique aux nœuds PROSPECT
        subtitle: `${prospectCount} prospect${prospectCount > 1 ? "s" : ""}`,
        details: [{ label: "Prospects", value: String(prospectCount) }],
      },
    })
  }
  if (personalCount > 0) {
    nodes.push({
      id:       "hub-perso",
      type:     "SOURCE",
      label:    "Perso",
      parentId: null,
      meta: {
        href:     "/contacts",
        color:    "#2dd4bf", // teal — identique aux nœuds PERSONAL
        subtitle: `${personalCount} proche${personalCount > 1 ? "s" : ""}`,
        details: [{ label: "Contacts perso", value: String(personalCount) }],
      },
    })
  }

  // ── Clients (contacts, prospects, proches) ────────────────────────────────
  for (const c of clients) {
    if (c.type === "SELF") continue
    const nodeId   = `client-${c.id}`
    const nodeType = c.type === "PROSPECT" ? "PROSPECT" as const
      : c.type === "PERSONAL" ? "PERSONAL" as const
      : "CLIENT" as const
    // Prospects et proches sont rattachés à leur hub ; les autres à leur société
    const parentId = nodeType === "PROSPECT" ? "hub-prospection"
      : nodeType === "PERSONAL" ? "hub-perso"
      : c.companyId ? `company-${c.companyId}` : null
    const projCount = projects.filter(p => p.clientId === c.id).length
    nodes.push({
      id:         nodeId,
      type:       nodeType,
      label:      c.name,
      parentId,
      // Un prospect est incomplet par nature : ne pas polluer le filtre « à compléter »
      incomplete: nodeType === "PROSPECT" ? false : isContactIncomplete(c),
      meta: {
        href:     `/contacts/${c.id}`,
        subtitle: c.email ?? c.city ?? undefined,
        details: [
          { label: "Projets", value: String(projCount) },
          { label: "Prénom / Nom", value: (c.firstName && c.lastName) ? `${c.firstName} ${c.lastName}` : "— à compléter" },
          ...(c.email ? [{ label: "Email", value: c.email }] : [{ label: "Email", value: "— manquant" }]),
          ...(c.phone ? [{ label: "Tél",   value: c.phone }] : []),
        ],
      },
    })
    if (parentId) links.push({ source: parentId, target: nodeId })
    // Un prospect/proche rattaché à une société garde ce lien en plus du hub
    if ((nodeType === "PROSPECT" || nodeType === "PERSONAL") && c.companyId) {
      links.push({ source: `company-${c.companyId}`, target: nodeId })
    }
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

  // ── ProjectContact — arêtes supplémentaires contact → projet (M2M) ────────
  // On ajoute un lien pour chaque contact associé au projet, SAUF si c'est déjà
  // le parentId (évite les doublons avec le lien principal clientId → project).
  const nodeIds = new Set(nodes.map(n => n.id))
  for (const pc of projectContactLinks) {
    const source = `client-${pc.clientId}`
    const target = `project-${pc.projectId}`
    if (!nodeIds.has(source) || !nodeIds.has(target)) continue
    // Éviter le doublon si ce contact est déjà le parent principal du projet
    const project = projects.find(p => p.id === pc.projectId)
    if (project?.clientId === pc.clientId) continue
    links.push({ source, target })
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
  // Recompute nodeIds pour inclure les nœuds ajoutés depuis la dernière mise à jour
  const revenueNodeIds = new Set(nodes.map(n => n.id))

  // Les reventes (source « Reventes ») sont traitées à part (bloc plus bas) :
  // regroupées par plateforme (Vinted/Leboncoin/Momox) sous la source, au lieu
  // d'être des revenus libres.
  const reventesSource = fiscalSources.find(s => s.name === "Reventes") ?? null

  for (const rev of revenues) {
    if (reventesSource && rev.fiscalSourceId === reventesSource.id) continue
    const revNodeId = `revenue-${rev.id}`

    // Cherche le premier ancêtre valide : project → company → client
    const rawParent = rev.projectId
      ? `project-${rev.projectId}`
      : rev.companyId
      ? `company-${rev.companyId}`
      : rev.clientId && !selfClientIds.has(rev.clientId)
      ? `client-${rev.clientId}`
      : null

    const parentId = rawParent && revenueNodeIds.has(rawParent) ? rawParent : null

    const date    = rev.receivedAt ?? rev.expectedAt
    const dateStr = date ? new Date(date).toLocaleDateString("fr-FR") : "—"

    nodes.push({
      id:         revNodeId,
      type:       "REVENUE",
      label:      rev.label,
      parentId,
      incomplete: parentId === null,
      status:     rev.status ?? undefined,
      amount:     rev.amount,
      meta: {
        href:     `/revenus`,
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

  // ── Job Applications (Entretiens) ─────────────────────────────────────────
  // Parenté : contactId (recruteur) → client-{id} en priorité, sinon companyId.
  const appNodeIds = new Set(nodes.map(n => n.id))
  for (const app of applications) {
    const appNodeId = `application-${app.id}`
    const parentByContact = app.contactId && appNodeIds.has(`client-${app.contactId}`)
      ? `client-${app.contactId}`
      : null
    const parentByCompany = !parentByContact && app.companyId && appNodeIds.has(`company-${app.companyId}`)
      ? `company-${app.companyId}`
      : null
    const parentId = parentByContact ?? parentByCompany ?? null

    const salaryStr = app.salaryMin && app.salaryMax
      ? `${app.salaryMin / 1000}–${app.salaryMax / 1000} k€`
      : app.salaryMin ? `dès ${app.salaryMin / 1000} k€` : null

    nodes.push({
      id:       appNodeId,
      type:     "APPLICATION",
      label:    app.position,
      parentId,
      status:   app.status,
      meta: {
        href:     `/entretiens/${app.id}`,
        subtitle: app.companyName,
        details: [
          { label: "Entreprise", value: app.companyName },
          { label: "Poste",      value: app.position    },
          ...(salaryStr ? [{ label: "Salaire", value: salaryStr }] : []),
        ],
      },
    })
    appNodeIds.add(appNodeId)
    if (parentId) links.push({ source: parentId, target: appNodeId })
  }

  // ── Hub Entretiens — regroupe toutes les sociétés de recrutement ──────────
  // On construit ce nœud après les applications pour connaître les sociétés
  // impliquées, puis on modifie leur parentId en place pour les relier.
  if (applications.length > 0) {
    const recruiterCompanyNodeIds = new Set<string>()
    for (const app of applications) {
      if (app.contactId) {
        const contact = clients.find(c => c.id === app.contactId)
        if (contact?.companyId) recruiterCompanyNodeIds.add(`company-${contact.companyId}`)
      }
      if (app.companyId && appNodeIds.has(`company-${app.companyId}`)) {
        recruiterCompanyNodeIds.add(`company-${app.companyId}`)
      }
    }
    if (recruiterCompanyNodeIds.size > 0) {
      const hubId = "hub-entretiens"
      nodes.push({
        id:       hubId,
        type:     "SOURCE",
        label:    "Entretiens",
        parentId: null,
        meta: {
          href:     "/entretiens",
          color:    "#818cf8",  // indigo — identique aux nœuds APPLICATION
          subtitle: `${applications.length} candidature${applications.length > 1 ? "s" : ""}`,
          details: [
            { label: "Candidatures", value: String(applications.length) },
          ],
        },
      })
      for (const node of nodes) {
        if (recruiterCompanyNodeIds.has(node.id)) {
          node.parentId = hubId
          links.push({ source: hubId, target: node.id })
        }
      }
    }
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
        href:     "/revenus/sources",
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

  // ── Reventes : source « Reventes » → plateforme (Vinted/Leboncoin/Momox) →
  // nœud de vente (type RESALE, ♻ teal). Les labels sont « Plateforme — objet ».
  if (reventesSource) {
    const srcNodeId = `source-${reventesSource.id}`
    const platformNodeId = new Map<string, string>() // plateforme → id de nœud
    for (const rev of revenues) {
      if (rev.fiscalSourceId !== reventesSource.id) continue
      const platform = (rev.label.split("—")[0] || "").trim() || "Autre"
      let platId = platformNodeId.get(platform)
      if (!platId) {
        platId = `resale-platform-${platform.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`
        platformNodeId.set(platform, platId)
        const platCount = revenues.filter(r => r.fiscalSourceId === reventesSource.id && r.label.startsWith(platform)).length
        nodes.push({
          id: platId, type: "COMPANY", label: platform, parentId: srcNodeId,
          meta: { subtitle: `Revente · ${platCount} vente${platCount > 1 ? "s" : ""}` },
        })
        links.push({ source: srcNodeId, target: platId })
      }
      const date    = rev.receivedAt ?? rev.expectedAt
      const dateStr = date ? new Date(date).toLocaleDateString("fr-FR") : "—"
      // Le préfixe plateforme est déjà porté par le nœud parent → on l'enlève du label
      const shortLabel = rev.label.includes("—") ? rev.label.split("—").slice(1).join("—").trim() : rev.label
      nodes.push({
        id:      `revenue-${rev.id}`,
        type:    "RESALE",
        label:   shortLabel,
        parentId: platId,
        status:  rev.status ?? undefined,
        amount:  rev.amount,
        meta: {
          href:     "/revenus",
          subtitle: `${rev.amount.toLocaleString("fr-FR")} €`,
          details: [
            { label: "Montant", value: `${rev.amount.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €` },
            { label: "Statut",  value: rev.status === "RECEIVED" ? "Reçu" : "En attente" },
            { label: "Date",    value: dateStr },
          ],
        },
      })
      links.push({ source: platId, target: `revenue-${rev.id}` })
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
