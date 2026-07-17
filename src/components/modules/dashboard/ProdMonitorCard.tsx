"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Server, RefreshCw, Loader2, ExternalLink } from "lucide-react"
import { checkAllProds } from "@/actions/postdev"

export type ProdStatus = {
  id: string
  projectId: string
  name: string
  url: string
  isUp: boolean | null
  statusCode: number | null
  checkedAt: Date | string | null
}

function relativeTime(value: Date | string | null): string {
  if (!value) return "jamais vérifié"
  const d = typeof value === "string" ? new Date(value) : value
  const diff = Date.now() - d.getTime()
  const min = Math.round(diff / 60000)
  if (min < 1) return "à l'instant"
  if (min < 60) return `il y a ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `il y a ${h} h`
  const j = Math.round(h / 24)
  return `il y a ${j} j`
}

export function ProdMonitorCard({ prods }: { prods: ProdStatus[] }) {
  const router = useRouter()
  const [isChecking, startCheck] = useTransition()
  const [lastResult, setLastResult] = useState<{ up: number; down: number } | null>(null)

  const upCount      = prods.filter(p => p.isUp === true).length
  const downCount    = prods.filter(p => p.isUp === false).length
  const unknownCount = prods.filter(p => p.isUp === null).length

  function handleCheck() {
    startCheck(async () => {
      const res = await checkAllProds()
      setLastResult({ up: res.up, down: res.down })
      router.refresh()
    })
  }

  return (
    <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <span className="text-muted-foreground"><Server className="h-4 w-4" /></span>
          Production
          <span className="text-xs font-normal text-muted-foreground">
            {prods.length} {prods.length > 1 ? "prods" : "prod"}
          </span>
        </div>
        {prods.length > 0 && (
          <button
            onClick={handleCheck}
            disabled={isChecking}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            {isChecking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {isChecking ? "Vérification…" : "Vérifier"}
          </button>
        )}
      </div>

      {prods.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">
          Aucune prod renseignée.
          <br />
          <span className="text-xs">Ajoute une URL de prod dans l’onglet Post-dev d’un projet.</span>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 px-4 py-2 text-xs border-b border-border/50">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" />{upCount} en ligne</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-500" />{downCount} hors ligne</span>
            {unknownCount > 0 && (
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-muted-foreground/40" />{unknownCount} inconnu</span>
            )}
            {lastResult && (
              <span className="ml-auto text-muted-foreground">{lastResult.up}/{prods.length} OK</span>
            )}
          </div>
          <div className="p-2 space-y-0.5">
            {prods.map(p => {
              const dot = p.isUp === true ? "bg-emerald-500" : p.isUp === false ? "bg-red-500" : "bg-muted-foreground/40"
              return (
                <div key={p.id} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted/50 transition-colors group">
                  <span className={`h-2 w-2 rounded-full shrink-0 ${dot}`} />
                  <Link href={`/projets/${p.projectId}/post-dev`} className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {relativeTime(p.checkedAt)}
                      {p.statusCode != null && ` · ${p.statusCode}`}
                    </p>
                  </Link>
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="text-muted-foreground md:opacity-0 md:group-hover:opacity-60 hover:opacity-100 focus:opacity-100 transition-opacity shrink-0"
                    title="Ouvrir la prod"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
