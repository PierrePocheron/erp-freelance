import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { SettingsForm } from "@/components/modules/settings/SettingsForm"
import { DangerZone } from "@/components/modules/settings/DangerZone"

export default async function SettingsPage() {
  const session = await auth()
  const userId = session!.user.id

  const [profile, user, conditionsTemplates] = await Promise.all([
    prisma.userProfile?.findUnique({ where: { userId } }).catch(() => null) ?? null,
    prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } }),
    prisma.conditionsTemplate.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    }),
  ])

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Paramètres</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Informations professionnelles utilisées dans vos devis et factures
        </p>
      </div>

      <SettingsForm
        userId={userId}
        profile={profile}
        userName={user?.name ?? null}
        userEmail={user?.email ?? null}
        conditionsTemplates={conditionsTemplates}
      />

      <DangerZone userId={userId} />
    </div>
  )
}
