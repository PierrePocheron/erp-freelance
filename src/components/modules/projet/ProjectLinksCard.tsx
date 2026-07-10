"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Link2, ExternalLink, Plus, Loader2, X } from "lucide-react"
import { LINK_CATEGORY_CONFIG, normalizeUrl } from "@/lib/link-categories"
import { createUsefulLink } from "@/actions/projet"
import { checkProjectLinksHealth } from "@/actions/postdev"
import { UsefulLinkDialog } from "./UsefulLinkDialog"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

type UsefulLink = {
  id: string
  label: string
  url: string
  category: string
}

type Health = { isUp: boolean | null; statusCode: number | null }

/**
 * Carte Liens du projet : liste compacte avec health check (sonde HEAD au
 * chargement), ajout inline dans la carte (pas de dialog), édition via le
 * crayon (dialog existant).
 */
export function ProjectLinksCard({ links, projectId }: { links: UsefulLink[]; projectId: string }) {
  const router = useRouter()
  const [health, setHealth] = useState<Record<string, Health>>({})
  const [checking, setChecking] = useState(false)
  const [adding, setAdding] = useState(false)
  const [label, setLabel] = useState("")
  const [url, setUrl] = useState("")
  const [category, setCategory] = useState("SITE")
  const [isPending, startTransition] = useTransition()

  // Sonde les liens au montage (et quand la liste change après un ajout)
  useEffect(() => {
    if (links.length === 0) return
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChecking(true)
    checkProjectLinksHealth(projectId)
      .then((results) => {
        if (cancelled) return
        setHealth(Object.fromEntries(results.map((r) => [r.linkId, { isUp: r.isUp, statusCode: r.statusCode }])))
      })
      .finally(() => { if (!cancelled) setChecking(false) })
    return () => { cancelled = true }
  }, [projectId, links.length])

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!label.trim() || !url.trim()) return
    startTransition(async () => {
      await createUsefulLink(projectId, { label: label.trim(), url: url.trim(), category })
      setLabel("")
      setUrl("")
      setCategory("SITE")
      setAdding(false)
      toast.success("Lien ajouté")
      router.refresh()
    })
  }

  return (
    <div className="rounded-xl border border-border/50 bg-card p-5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-semibold text-sm">
          <Link2 className="h-4 w-4 text-muted-foreground" />
          Liens
          {checking && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </div>
        <button
          onClick={() => setAdding((v) => !v)}
          className="flex items-center gap-1 text-xs text-primary hover:underline shrink-0"
        >
          {adding ? <><X className="h-3 w-3" /> Fermer</> : <><Plus className="h-3 w-3" /> Ajouter</>}
        </button>
      </div>

      {/* Formulaire d'ajout inline */}
      {adding && (
        <form onSubmit={handleAdd} className="space-y-2 rounded-lg border border-primary/30 bg-muted/20 p-2.5">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Libellé"
            autoFocus
            className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
            className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <div className="flex items-center gap-2">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="flex-1 h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {Object.entries(LINK_CATEGORY_CONFIG).map(([v, c]) => (
                <option key={v} value={v}>{c.label}</option>
              ))}
            </select>
            <button
              type="submit"
              disabled={isPending || !label.trim() || !url.trim()}
              className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium disabled:opacity-40 hover:bg-primary/90 transition-colors"
            >
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Ajouter"}
            </button>
          </div>
        </form>
      )}

      {links.length === 0 && !adding ? (
        <p className="text-xs text-muted-foreground italic">Aucun lien — ajoutez le site, le repo, la doc…</p>
      ) : (
        <div className="space-y-1.5">
          {links.map((l) => {
            const cat = LINK_CATEGORY_CONFIG[l.category] ?? LINK_CATEGORY_CONFIG.OTHER
            const h = health[l.id]
            return (
              <div key={l.id} className="flex items-center gap-2 py-1 group">
                {/* Health check — vert/rouge, gris si non sondable (URL locale) */}
                <span
                  className={cn(
                    "h-2 w-2 rounded-full shrink-0",
                    checking && !h ? "bg-muted-foreground/30 animate-pulse" :
                    h?.isUp === true ? "bg-emerald-500" :
                    h?.isUp === false ? "bg-red-500" :
                    "bg-muted-foreground/30"
                  )}
                  title={
                    h?.isUp === true ? `En ligne${h.statusCode ? ` (${h.statusCode})` : ""}` :
                    h?.isUp === false ? `Hors ligne${h.statusCode ? ` (${h.statusCode})` : ""}` :
                    "Statut inconnu"
                  }
                />
                <a
                  href={normalizeUrl(l.url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 min-w-0 flex items-center gap-1.5 text-sm hover:text-primary transition-colors"
                >
                  <span className="truncate">{l.label}</span>
                  <ExternalLink className="h-2.5 w-2.5 opacity-50 shrink-0" />
                </a>
                <span className={cn("shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium", cat.cls)}>
                  {cat.label}
                </span>
                <UsefulLinkDialog projectId={projectId} link={{ id: l.id, label: l.label, url: l.url, category: l.category }} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
