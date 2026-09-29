import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { ClientFilesPanel } from "@/components/modules/crm/ClientFilesPanel"

export default async function ClientFichiersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  const client = await prisma.client.findFirst({
    where: { id, userId: session!.user.id },
    select: { id: true, files: { orderBy: { createdAt: "desc" }, select: { id: true, name: true, fileUrl: true, type: true, createdAt: true } } },
  })
  if (!client) notFound()

  return (
    <ClientFilesPanel
      clientId={client.id}
      files={client.files.map((f) => ({ ...f, createdAt: f.createdAt.toISOString() }))}
    />
  )
}
