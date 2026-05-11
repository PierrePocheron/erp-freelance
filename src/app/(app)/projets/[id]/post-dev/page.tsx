import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { Server } from "lucide-react"

export default async function ProjectPostDevPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await auth()

  const project = await prisma.project.findFirst({
    where: { id, userId: session!.user.id },
  })

  if (!project) notFound()

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
      <Server className="h-10 w-10 text-muted-foreground mb-3" />
      <p className="font-medium">Post-Dev</p>
      <p className="text-sm text-muted-foreground mt-1">
        Monitoring et renouvellements — à venir dans une prochaine session
      </p>
    </div>
  )
}
