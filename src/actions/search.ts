"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export type SearchResult = {
  id: string
  type: "client" | "project" | "quote" | "invoice" | "company" | "fiscal_source"
      | "task" | "job_application" | "health_event" | "health_consultation"
  label: string
  sublabel?: string
  href: string
}

export async function searchGlobal(query: string, activeModuleIds?: string[]): Promise<SearchResult[]> {
  if (query.length < 2) return []
  const session = await auth()
  if (!session) return []
  const userId = session.user.id

  const has = (id: string) => !activeModuleIds || activeModuleIds.includes(id)
  const empty = <T>() => Promise.resolve([] as T[])

  const [
    companies, clients, projects, quotes, invoices, fiscalSources,
    tasks, jobApplications, healthEvents, healthConsultations,
  ] = await Promise.all([
    has("societes") ? prisma.company.findMany({
      where: { userId, OR: [
        { name: { contains: query, mode: "insensitive" } },
        { city: { contains: query, mode: "insensitive" } },
        { siret: { contains: query, mode: "insensitive" } },
      ]},
      take: 4,
      select: { id: true, name: true, city: true },
    }) : empty<{ id: string; name: string; city: string | null }>(),

    has("contacts") ? prisma.client.findMany({
      where: { userId, type: { not: "SELF" }, OR: [
        { name: { contains: query, mode: "insensitive" } },
        { company: { contains: query, mode: "insensitive" } },
      ]},
      take: 4,
      select: { id: true, name: true, company: true },
    }) : empty<{ id: string; name: string; company: string | null }>(),

    has("projets") ? prisma.project.findMany({
      where: { userId, name: { contains: query, mode: "insensitive" } },
      take: 4,
      select: { id: true, name: true },
    }) : empty<{ id: string; name: string }>(),

    has("facturation") ? prisma.quote.findMany({
      where: { userId, OR: [
        { number: { contains: query, mode: "insensitive" } },
        { client: { name: { contains: query, mode: "insensitive" } } },
      ]},
      take: 3,
      select: { id: true, number: true, client: { select: { name: true, company: true } } },
    }) : empty<{ id: string; number: string; client: { name: string; company: string | null } }>(),

    has("facturation") ? prisma.invoice.findMany({
      where: { userId, OR: [
        { number: { contains: query, mode: "insensitive" } },
        { client: { name: { contains: query, mode: "insensitive" } } },
      ]},
      take: 3,
      select: { id: true, number: true, client: { select: { name: true, company: true } } },
    }) : empty<{ id: string; number: string; client: { name: string; company: string | null } }>(),

    has("revenus") ? prisma.fiscalSource.findMany({
      where: { userId, name: { contains: query, mode: "insensitive" } },
      take: 3,
      select: { id: true, name: true, bucket: true },
    }) : empty<{ id: string; name: string; bucket: string }>(),

    (has("taches") || has("projets")) ? prisma.task.findMany({
      where: {
        OR: [{ project: { userId } }, { userId }],
        title: { contains: query, mode: "insensitive" },
        parentTaskId: null,
      },
      take: 4,
      select: { id: true, title: true, project: { select: { id: true, name: true } } },
    }) : empty<{ id: string; title: string; project: { id: string; name: string } | null }>(),

    has("entretien") ? prisma.jobApplication.findMany({
      where: { userId, OR: [
        { companyName: { contains: query, mode: "insensitive" } },
        { position:    { contains: query, mode: "insensitive" } },
        { location:    { contains: query, mode: "insensitive" } },
      ]},
      take: 3,
      select: { id: true, companyName: true, position: true, status: true },
    }) : empty<{ id: string; companyName: string; position: string; status: string }>(),

    has("sante") ? prisma.healthEvent.findMany({
      where: { userId, OR: [
        { title:    { contains: query, mode: "insensitive" } },
        { bodyPart: { contains: query, mode: "insensitive" } },
      ]},
      take: 3,
      select: { id: true, title: true, bodyPart: true },
    }) : empty<{ id: string; title: string; bodyPart: string | null }>(),

    has("sante") ? prisma.healthConsultation.findMany({
      where: { userId, OR: [
        { practitionerName: { contains: query, mode: "insensitive" } },
        { title:            { contains: query, mode: "insensitive" } },
      ]},
      take: 3,
      select: { id: true, title: true, practitionerName: true },
    }) : empty<{ id: string; title: string; practitionerName: string }>(),
  ])

  const BUCKET_LABELS: Record<string, string> = {
    AE_URSSAF: "AE / URSSAF", NON_IMPOSABLE: "Non imposable", OTHER: "Autre",
  }

  return [
    ...companies.map((c) => ({
      id: c.id, type: "company" as const,
      label: c.name, sublabel: c.city ?? undefined,
      href: `/societes/${c.id}`,
    })),
    ...clients.map((c) => ({
      id: c.id, type: "client" as const,
      label: c.company ?? c.name, sublabel: c.company ? c.name : undefined,
      href: `/contacts/${c.id}`,
    })),
    ...projects.map((p) => ({
      id: p.id, type: "project" as const,
      label: p.name,
      href: `/projets/${p.id}`,
    })),
    ...quotes.map((q) => ({
      id: q.id, type: "quote" as const,
      label: q.number, sublabel: q.client.company ?? q.client.name,
      href: `/facturation/devis/${q.id}`,
    })),
    ...invoices.map((i) => ({
      id: i.id, type: "invoice" as const,
      label: i.number, sublabel: i.client.company ?? i.client.name,
      href: `/facturation/factures/${i.id}`,
    })),
    ...fiscalSources.map((s) => ({
      id: s.id, type: "fiscal_source" as const,
      label: s.name, sublabel: BUCKET_LABELS[s.bucket] ?? s.bucket,
      href: `/revenus/sources`,
    })),
    ...tasks.map((t) => ({
      id: t.id, type: "task" as const,
      label: t.title, sublabel: t.project?.name,
      href: t.project ? `/projets/${t.project.id}/dev` : "/taches",
    })),
    ...jobApplications.map((a) => ({
      id: a.id, type: "job_application" as const,
      label: a.companyName, sublabel: a.position,
      href: `/entretiens/${a.id}`,
    })),
    ...healthEvents.map((e) => ({
      id: e.id, type: "health_event" as const,
      label: e.title, sublabel: e.bodyPart ?? undefined,
      href: `/sante`,
    })),
    ...healthConsultations.map((c) => ({
      id: c.id, type: "health_consultation" as const,
      label: c.practitionerName, sublabel: c.title,
      href: `/sante`,
    })),
  ]
}
