import { auth } from "@/lib/auth"

export default async function DashboardPage() {
  const session = await auth()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Bonjour, {session?.user?.name?.split(" ")[0]} 👋
        </h1>
        <p className="text-muted-foreground text-sm">
          Voici un aperçu de votre activité
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-border/50 bg-card p-5">
          <p className="text-sm text-muted-foreground">Dashboard en cours de construction</p>
        </div>
      </div>
    </div>
  )
}
