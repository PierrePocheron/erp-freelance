import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { ClientTabs } from "@/components/modules/crm/ClientTabs"
import { ClientTypeSelect } from "@/components/modules/crm/ClientTypeSelect"
import { TemperatureSelect } from "@/components/modules/crm/TemperatureSelect"
import type { Metadata } from "next"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const client = await prisma.client.findFirst({
    where: { id },
    select: { name: true, company: true },
  })
  const label = client ? (client.company ? `${client.name} · ${client.company}` : client.name) : "Fiche client"
  return { title: `${label} — ERP Freelance` }
}

export default async function ClientLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await auth()
  const userId = session!.user.id

  const client = await prisma.client.findFirst({
    where: {
      id,
      OR: [
        { userId },
        // Collaborateurs d'un projet lié à ce client
        { projects: { some: { members: { some: { userId } } } } },
      ],
    },
  })

  if (!client) notFound()

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/client"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3"
        >
          <ChevronLeft className="h-4 w-4" /> Clients
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">
              {client.company ? `Société — ${client.company}` : "Contact"}
            </p>
            <h1 className="text-2xl font-bold tracking-tight">{client.name}</h1>
            <div className="flex items-center gap-3 pt-1">
              <ClientTypeSelect clientId={id} userId={userId} value={client.type} />
              <TemperatureSelect clientId={id} userId={userId} value={client.temperature} />
            </div>
          </div>
        </div>
      </div>

      <ClientTabs clientId={id} />
      {children}
    </div>
  )
}
