import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { RecurrentesManager } from "@/components/modules/facturation/RecurrentesManager"

type RecurringLine = {
  id: string
  recurringInvoiceId: string
  description: string
  quantity: number
  unitPrice: number
  taxRate: number
  total: number
  productId: string | null
}

type RecurringRowRaw = {
  id: string
  name: string
  frequency: string
  nextGenerationDate: Date
  isActive: boolean
  createdAt: Date
  totalHT: number
  client: { id: string; name: string; company: string | null }
  project: { id: string; name: string } | null
}

type RecurringRow = RecurringRowRaw & {
  lines: Omit<RecurringLine, "recurringInvoiceId">[]
}

const prismaExt = prisma as never as {
  recurringInvoice: {
    findMany: (args: unknown) => Promise<RecurringRowRaw[]>
  }
}

export default async function RecurrentesPage() {
  const session = await auth()
  const userId = session!.user.id

  const [recurringInvoicesRaw, clients, projects, products] = await Promise.all([
    prismaExt.recurringInvoice.findMany({
      where: { userId },
      orderBy: { nextGenerationDate: "asc" },
      include: {
        client: { select: { id: true, name: true, company: true } },
        project: { select: { id: true, name: true } },
      },
    }),
    prisma.client.findMany({
      where: { userId, type: { not: "SELF" } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, company: true, type: true },
    }),
    prisma.project.findMany({
      where: { userId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, clientId: true },
    }),
    prisma.product.findMany({
      where: { userId, isActive: true },
      orderBy: { name: "asc" },
    }) as unknown as Array<{ id: string; name: string; unitPrice: number; defaultTaxRate: number; unit: string }>,
  ])

  // Fetch lines via raw SQL (RecurringInvoiceLine not registered in Prisma schema)
  const invoiceIds = recurringInvoicesRaw.map((r) => r.id)
  const allLines: RecurringLine[] =
    invoiceIds.length > 0
      ? await prisma.$queryRawUnsafe<RecurringLine[]>(
          `SELECT id, "recurringInvoiceId", description, quantity, "unitPrice", "taxRate", total, "productId"
           FROM "RecurringInvoiceLine"
           WHERE "recurringInvoiceId" = ANY($1::text[])
           ORDER BY id ASC`,
          invoiceIds
        )
      : []

  // Merge lines + compute totalHT from lines (DB column may not be in Prisma schema)
  const recurringInvoices: RecurringRow[] = recurringInvoicesRaw.map((r) => {
    const rowLines = allLines.filter((l) => l.recurringInvoiceId === r.id)
    return {
      ...r,
      totalHT: rowLines.reduce((s, l) => s + Number(l.total), 0),
      lines: rowLines.map(({ recurringInvoiceId: _rid, ...rest }) => rest),
    }
  })

  return (
    <RecurrentesManager
      userId={userId}
      clients={clients}
      projects={projects}
      products={products}
      recurringInvoices={recurringInvoices}
    />
  )
}
