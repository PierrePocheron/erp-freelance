"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export type SearchResult = {
  id: string
  type: "client" | "project" | "quote" | "invoice"
  label: string
  sublabel?: string
  href: string
}

export async function searchGlobal(query: string): Promise<SearchResult[]> {
  if (query.length < 2) return []
  const session = await auth()
  if (!session) return []
  const userId = session.user.id

  const [clients, projects, quotes, invoices] = await Promise.all([
    prisma.client.findMany({
      where: { userId, type: { not: "SELF" }, OR: [
        { name: { contains: query, mode: "insensitive" } },
        { company: { contains: query, mode: "insensitive" } },
      ]},
      take: 4,
      select: { id: true, name: true, company: true },
    }),
    prisma.project.findMany({
      where: { userId, name: { contains: query, mode: "insensitive" } },
      take: 4,
      select: { id: true, name: true },
    }),
    prisma.quote.findMany({
      where: { userId, OR: [
        { number: { contains: query, mode: "insensitive" } },
        { client: { name: { contains: query, mode: "insensitive" } } },
      ]},
      take: 3,
      select: { id: true, number: true, client: { select: { name: true, company: true } } },
    }),
    prisma.invoice.findMany({
      where: { userId, OR: [
        { number: { contains: query, mode: "insensitive" } },
        { client: { name: { contains: query, mode: "insensitive" } } },
      ]},
      take: 3,
      select: { id: true, number: true, client: { select: { name: true, company: true } } },
    }),
  ])

  return [
    ...clients.map((c) => ({
      id: c.id,
      type: "client" as const,
      label: c.company ?? c.name,
      sublabel: c.company ? c.name : undefined,
      href: `/client/${c.id}`,
    })),
    ...projects.map((p) => ({
      id: p.id,
      type: "project" as const,
      label: p.name,
      href: `/projets/${p.id}`,
    })),
    ...quotes.map((q) => ({
      id: q.id,
      type: "quote" as const,
      label: q.number,
      sublabel: q.client.company ?? q.client.name,
      href: `/facturation/devis/${q.id}`,
    })),
    ...invoices.map((i) => ({
      id: i.id,
      type: "invoice" as const,
      label: i.number,
      sublabel: i.client.company ?? i.client.name,
      href: `/facturation/factures/${i.id}`,
    })),
  ]
}
