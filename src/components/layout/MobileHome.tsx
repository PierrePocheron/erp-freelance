"use client"

import Link from "next/link"
import { CalendarCheck, CheckSquare, Hourglass, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { useModules } from "@/hooks/use-modules"
import { navItems } from "@/components/layout/Sidebar"
import { OPEN_COMMAND_PALETTE_EVENT } from "@/components/layout/CommandPalette"

type MobileHomeProps = {
  /** Tâches dues aujourd'hui (0 si les modules tâches/projets sont inactifs) */
  todayTasksCount: number
  /** Montant total en attente de réception (factures + revenus + remboursements), en € */
  pendingAmount: number
  /** Items du passé récent à confirmer (tâches, jalons, événements) */
  toConfirmCount: number
}

/**
 * Accueil mobile — remplace le dashboard sur petit écran (rendu dans un wrapper
 * `sm:hidden` par la page dashboard, qui lui passe des props déjà fetchées).
 * De haut en bas : recherche (ouvre la CommandPalette), strip « Aujourd'hui »,
 * grille des modules actifs.
 */
export function MobileHome({ todayTasksCount, pendingAmount, toConfirmCount }: MobileHomeProps) {
  const { isActive } = useModules()

  // Tuiles = navItems de la Sidebar (source de vérité route + icône + module),
  // sans le Dashboard (on y est déjà), filtrées par modules actifs.
  // Paramètres n'a pas de moduleId → toujours visible.
  const tiles = navItems.filter(
    (item) => item.href !== "/" && (!item.moduleId || isActive(item.moduleId))
  )

  const showToday = todayTasksCount > 0 || pendingAmount > 0 || toConfirmCount > 0

  return (
    <div className="space-y-5">
      {/* Recherche — ouvre la CommandPalette (utilisable au tactile) */}
      <button
        type="button"
        onClick={() => window.dispatchEvent(new CustomEvent(OPEN_COMMAND_PALETTE_EVENT))}
        className="flex w-full items-center gap-3 rounded-xl border border-border/50 bg-card px-4 py-3 text-sm text-muted-foreground transition-colors active:bg-accent"
      >
        <Search className="h-4 w-4 shrink-0" />
        Rechercher…
      </button>

      {/* Strip « Aujourd'hui » — uniquement si au moins une donnée non vide */}
      {showToday && (
        <section className="space-y-1.5">
          <h2 className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Aujourd&apos;hui
          </h2>
          <div className="flex gap-2">
            {todayTasksCount > 0 && (
              <StatCard
                href="/taches"
                icon={<CheckSquare className="h-3.5 w-3.5" />}
                label="Tâches"
                value={todayTasksCount}
                valueClass="text-primary"
              />
            )}
            {pendingAmount > 0 && (
              <StatCard
                href="/revenus"
                icon={<Hourglass className="h-3.5 w-3.5" />}
                label="En attente"
                value={`${pendingAmount.toLocaleString("fr-FR")} €`}
                valueClass="text-amber-600"
              />
            )}
            {toConfirmCount > 0 && (
              <StatCard
                href="/"
                icon={<CalendarCheck className="h-3.5 w-3.5" />}
                label="À confirmer"
                value={toConfirmCount}
                valueClass="text-fuchsia-600"
              />
            )}
          </div>
        </section>
      )}

      {/* Grille des modules actifs */}
      <section className="space-y-1.5">
        <h2 className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Modules
        </h2>
        <div className="grid grid-cols-4 gap-2">
          {tiles.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              className="flex aspect-square min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-xl border border-border/50 bg-card p-1.5 transition-colors active:bg-accent"
            >
              <Icon className="h-6 w-6 text-muted-foreground" />
              <span className="max-w-full truncate text-[10px] font-medium">{label}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}

function StatCard({
  href, icon, label, value, valueClass,
}: {
  href: string
  icon: React.ReactNode
  label: string
  value: string | number
  valueClass?: string
}) {
  return (
    <Link
      href={href}
      className="min-w-0 flex-1 rounded-xl border border-border/50 bg-card px-3 py-2.5 transition-colors active:bg-accent"
    >
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="truncate text-[10px] font-medium">{label}</span>
      </div>
      <p className={cn("mt-1.5 text-lg font-bold tabular-nums leading-none", valueClass)}>{value}</p>
    </Link>
  )
}
