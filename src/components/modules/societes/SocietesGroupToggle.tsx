"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Tag, Wallet } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Bascule le regroupement de la liste des sociétés : par catégorie libre ou par
 * source fiscale. Pilote le paramètre d'URL `?group=` (shallow, sans scroll) —
 * même approche que les filtres de la prospection ; « fiscale » = défaut (pas de param).
 */
export function SocietesGroupToggle({ value }: { value: "categorie" | "fiscale" }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function setGroup(next: "categorie" | "fiscale") {
    const params = new URLSearchParams(searchParams)
    if (next === "fiscale") params.delete("group")
    else params.set("group", next)
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  const opts = [
    { key: "categorie" as const, label: "Catégorie", Icon: Tag },
    { key: "fiscale" as const, label: "Source fiscale", Icon: Wallet },
  ]

  return (
    <div className="inline-flex items-center rounded-md border border-border p-0.5" role="group" aria-label="Grouper les sociétés par">
      {opts.map(({ key, label, Icon }) => {
        const active = value === key
        return (
          <button
            key={key}
            type="button"
            onClick={() => setGroup(key)}
            aria-pressed={active}
            className={cn(
              "inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors",
              active ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden /> {label}
          </button>
        )
      })}
    </div>
  )
}
