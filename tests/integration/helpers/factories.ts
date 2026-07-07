import { prisma } from "@/lib/prisma"

// Petits factories pour préparer l'état en base avant d'exercer les Server Actions.
// IDs uniques par appel pour ne pas dépendre de l'ordre des tests.

let counter = 0
export function uniq(prefix = "x"): string {
  return `${prefix}-${Date.now().toString(36)}-${counter++}`
}

export async function makeUser(id?: string) {
  const uid = id ?? uniq("user")
  return prisma.user.create({
    data: { id: uid, email: `${uid}@test.local`, name: `User ${uid}` },
  })
}

export async function makeClient(userId: string, overrides: Record<string, unknown> = {}) {
  return prisma.client.create({
    data: { userId, name: "ACME", ...overrides },
  })
}

export async function makeCompany(userId: string, overrides: Record<string, unknown> = {}) {
  return prisma.company.create({
    data: { userId, name: `Acme ${uniq("co")}`, ...overrides },
  })
}

export async function makeProject(userId: string, clientId: string, name = "Site web") {
  return prisma.project.create({ data: { userId, clientId, name } })
}

export type SeedLine = {
  description: string
  quantity: number
  unitPrice: number
  taxRate?: number
  total?: number
}

function lineData(l: SeedLine) {
  return {
    description: l.description,
    quantity: l.quantity,
    unitPrice: l.unitPrice,
    taxRate: l.taxRate ?? 0,
    total: l.total ?? l.quantity * l.unitPrice,
  }
}

export async function makeQuote(
  userId: string,
  clientId: string,
  opts: {
    number?: string
    projectId?: string
    depositPercent?: number
    totalHT?: number
    generalConditions?: string | null
    status?: string
    lines?: SeedLine[]
  } = {}
) {
  const lines = opts.lines ?? []
  const totalHT = opts.totalHT ?? lines.reduce((s, l) => s + (l.total ?? l.quantity * l.unitPrice), 0)
  return prisma.quote.create({
    data: {
      userId,
      clientId,
      projectId: opts.projectId ?? null,
      number: opts.number ?? uniq("DEV"),
      depositPercent: opts.depositPercent ?? 0,
      totalHT,
      generalConditions: opts.generalConditions ?? null,
      status: (opts.status ?? "DRAFT") as never,
      lines: { create: lines.map(lineData) },
    },
    include: { lines: true },
  })
}

export async function makeInvoice(
  userId: string,
  clientId: string,
  opts: {
    number?: string
    type?: string
    status?: string
    totalHT?: number
    depositDeducted?: number
    quoteId?: string
    lines?: SeedLine[]
  } = {}
) {
  const lines = opts.lines ?? []
  const totalHT = opts.totalHT ?? lines.reduce((s, l) => s + (l.total ?? l.quantity * l.unitPrice), 0)
  return prisma.invoice.create({
    data: {
      userId,
      clientId,
      quoteId: opts.quoteId ?? null,
      number: opts.number ?? uniq("FAC"),
      type: (opts.type ?? "STANDALONE") as never,
      status: (opts.status ?? "DRAFT") as never,
      totalHT,
      depositDeducted: opts.depositDeducted ?? 0,
      lines: { create: lines.map(lineData) },
    },
    include: { lines: true },
  })
}

// Chaîne projet → postDev → renouvellement (pour facturer un renouvellement).
export async function makeRenewalChain(
  userId: string,
  clientId: string,
  opts: {
    type?: "DOMAIN" | "HOSTING" | "OTHER"
    name?: string
    amount?: number | null
    periodMonths?: number | null
    expiresAt?: Date
  } = {}
) {
  const project = await prisma.project.create({ data: { userId, clientId, name: "Prod hébergée" } })
  const postDev = await prisma.postDev.create({ data: { projectId: project.id } })
  const renewal = await prisma.renewal.create({
    data: {
      postDevId: postDev.id,
      type: (opts.type ?? "HOSTING") as never,
      name: opts.name ?? "Hébergement annuel",
      amount: opts.amount === undefined ? 120 : opts.amount,
      periodMonths: opts.periodMonths ?? null,
      expiresAt: opts.expiresAt ?? new Date("2026-07-01T00:00:00Z"),
    },
  })
  return { project, postDev, renewal }
}

export async function makeJobApplication(
  userId: string,
  opts: {
    companyName?: string
    position?: string
    status?: string
    priority?: number
  } = {}
) {
  return prisma.jobApplication.create({
    data: {
      userId,
      companyName: opts.companyName ?? "ACME Corp",
      position: opts.position ?? "Développeur",
      status: (opts.status ?? "WISHLIST") as never,
      priority: opts.priority ?? 0,
    },
  })
}

export async function makeConditionsTemplate(
  userId: string,
  opts: { name: string; content: string; isDefault?: boolean }
) {
  return prisma.conditionsTemplate.create({
    data: { userId, name: opts.name, content: opts.content, isDefault: opts.isDefault ?? false },
  })
}
