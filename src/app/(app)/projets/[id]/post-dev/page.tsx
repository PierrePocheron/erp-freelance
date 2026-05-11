import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { upsertPostDev, addRenewal, deleteRenewal } from "@/actions/postdev"
import { MonitoringButton } from "@/components/modules/projet/MonitoringButton"
import {
  Globe, ShieldCheck, Server, Building2,
  Trash2, CheckCircle2, XCircle, Clock, Plus, RefreshCw,
} from "lucide-react"
import { cn } from "@/lib/utils"

const renewalTypes = [
  { value: "DOMAIN", label: "Domaine" },
  { value: "HOSTING", label: "Hébergement" },
  { value: "OTHER", label: "Autre" },
]

export default async function ProjectPostDevPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await auth()
  const userId = session!.user.id

  const project = await prisma.project.findFirst({
    where: { id, userId },
    include: {
      postDev: {
        include: {
          renewals: { orderBy: { expiresAt: "asc" } },
          monitoringChecks: { orderBy: { checkedAt: "desc" }, take: 10 },
        },
      },
    },
  })

  if (!project) notFound()

  const postDev = project.postDev
  const lastCheck = postDev?.monitoringChecks[0]

  const minExpiry = new Date()
  minExpiry.setFullYear(minExpiry.getFullYear() + 1)
  const defaultExpiry = minExpiry.toISOString().split("T")[0]

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

      {/* URLs de production */}
      <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold">URLs de production</h2>
        </div>
        <form
          action={async (fd: FormData) => {
            "use server"
            await upsertPostDev(id, userId, {
              prodUrl: (fd.get("prodUrl") as string) || null,
              adminUrl: (fd.get("adminUrl") as string) || null,
              hostingUrl: (fd.get("hostingUrl") as string) || null,
              registrarUrl: (fd.get("registrarUrl") as string) || null,
            })
          }}
          className="space-y-3"
        >
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground flex items-center gap-1.5"><Globe className="h-3 w-3" />URL production</label>
            <Input name="prodUrl" type="url" defaultValue={postDev?.prodUrl ?? ""} placeholder="https://monsite.com" className="h-8 font-mono text-xs" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground flex items-center gap-1.5"><ShieldCheck className="h-3 w-3" />Panneau admin</label>
            <Input name="adminUrl" type="url" defaultValue={postDev?.adminUrl ?? ""} placeholder="https://monsite.com/admin" className="h-8 font-mono text-xs" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground flex items-center gap-1.5"><Server className="h-3 w-3" />Hébergeur</label>
            <Input name="hostingUrl" type="url" defaultValue={postDev?.hostingUrl ?? ""} placeholder="https://o2switch.fr" className="h-8 font-mono text-xs" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground flex items-center gap-1.5"><Building2 className="h-3 w-3" />Registrar domaine</label>
            <Input name="registrarUrl" type="url" defaultValue={postDev?.registrarUrl ?? ""} placeholder="https://ovh.com" className="h-8 font-mono text-xs" />
          </div>
          <Button type="submit" size="sm" variant="outline" className="w-full">Enregistrer</Button>
        </form>
      </div>

      {/* Monitoring */}
      <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold">Monitoring</h2>
        </div>

        {!postDev?.prodUrl ? (
          <p className="text-sm text-muted-foreground">Renseignez l'URL de production pour activer le monitoring.</p>
        ) : (
          <div className="space-y-4">
            {/* Statut actuel */}
            {lastCheck && (
              <div className={cn(
                "flex items-center gap-3 rounded-lg p-3",
                lastCheck.isUp ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-red-500/10 border border-red-500/20"
              )}>
                {lastCheck.isUp
                  ? <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                  : <XCircle className="h-5 w-5 text-red-500 shrink-0" />}
                <div>
                  <p className={`font-medium text-sm ${lastCheck.isUp ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
                    {lastCheck.isUp ? "Site en ligne" : "Site hors ligne"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Vérifié le {new Date(lastCheck.checkedAt).toLocaleDateString("fr-FR", {
                      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
                    })}
                    {lastCheck.responseTimeMs && ` · ${lastCheck.responseTimeMs}ms`}
                  </p>
                </div>
              </div>
            )}

            <MonitoringButton postDevId={postDev.id} projectId={id} url={postDev.prodUrl} />

            {/* Historique */}
            {postDev.monitoringChecks.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Historique</p>
                <div className="flex gap-1">
                  {postDev.monitoringChecks.slice(0, 20).reverse().map((check) => (
                    <div
                      key={check.id}
                      title={`${new Date(check.checkedAt).toLocaleString("fr-FR")} — ${check.isUp ? "OK" : "KO"}`}
                      className={`h-6 w-2 rounded-sm ${check.isUp ? "bg-emerald-500" : "bg-red-500"}`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Renouvellements */}
      <div className="lg:col-span-2 rounded-xl border border-border/50 bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold">Renouvellements</h2>
        </div>

        {!postDev ? (
          <p className="text-sm text-muted-foreground">Enregistrez d'abord les URLs pour ajouter des renouvellements.</p>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Formulaire */}
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ajouter</p>
              <form
                action={async (fd: FormData) => {
                  "use server"
                  await addRenewal(postDev.id, id, {
                    type: fd.get("type") as string,
                    name: fd.get("name") as string,
                    expiresAt: fd.get("expiresAt") as string,
                  })
                }}
                className="space-y-2"
              >
                <select name="type" className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                  {renewalTypes.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <Input name="name" required placeholder="monsite.com" className="h-8" />
                <Input name="expiresAt" type="date" required defaultValue={defaultExpiry} className="h-8" />
                <Button type="submit" size="sm" variant="outline" className="w-full">
                  <Plus className="h-3.5 w-3.5" />
                  Ajouter
                </Button>
              </form>
            </div>

            {/* Liste */}
            <div className="lg:col-span-2 space-y-2">
              {postDev.renewals.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun renouvellement enregistré</p>
              ) : (
                postDev.renewals.map((r) => {
                  const now = new Date()
                  const expires = new Date(r.expiresAt)
                  const daysLeft = Math.ceil((expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                  const isExpired = daysLeft < 0
                  const isSoon = daysLeft >= 0 && daysLeft <= 30

                  return (
                    <div
                      key={r.id}
                      className={cn(
                        "group flex items-center gap-3 rounded-lg border p-3",
                        isExpired ? "border-red-500/30 bg-red-500/5" :
                        isSoon ? "border-amber-500/30 bg-amber-500/5" :
                        "border-border/50 bg-card"
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "text-xs rounded-full px-2 py-0.5 font-medium",
                            r.type === "DOMAIN" ? "bg-indigo-500/15 text-indigo-600" :
                            r.type === "HOSTING" ? "bg-blue-500/15 text-blue-600" :
                            "bg-muted text-muted-foreground"
                          )}>
                            {renewalTypes.find(t => t.value === r.type)?.label}
                          </span>
                          <span className="text-sm font-medium">{r.name}</span>
                        </div>
                        <p className={cn("text-xs mt-0.5", isExpired ? "text-red-500 font-medium" : isSoon ? "text-amber-600 font-medium" : "text-muted-foreground")}>
                          Expire le {expires.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                          {isExpired && " · Expiré !"}
                          {isSoon && !isExpired && ` · Dans ${daysLeft} jour${daysLeft !== 1 ? "s" : ""}`}
                        </p>
                      </div>
                      <form action={async () => { "use server"; await deleteRenewal(r.id, id) }}>
                        <button type="submit" className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </form>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
