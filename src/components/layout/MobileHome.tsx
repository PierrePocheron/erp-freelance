"use client"

import Link from "next/link"
import { AlertCircle, CalendarCheck, ChevronRight, Hourglass, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { useModules } from "@/hooks/use-modules"
import { navItems } from "@/components/layout/Sidebar"
import { OPEN_COMMAND_PALETTE_EVENT } from "@/components/layout/CommandPalette"
import { OPEN_INCOMPLETE_SHEET_EVENT } from "@/components/modules/dashboard/IncompleteDataSheet"
import { PushNotificationsCard } from "@/components/layout/PushNotificationsCard"

type MobileHomeProps = {
  /** Montant total en attente de réception (factures + revenus + remboursements), en € */
  pendingAmount: number
  /** Items du passé récent à confirmer (tâches, jalons, événements) */
  toConfirmCount: number
  /** Données incomplètes par module (0 si module inactif côté serveur) */
  incomplete: { contacts: number; societes: number; revenus: number; depenses: number }
}

/**
 * Accueil mobile — remplace le dashboard sur petit écran (rendu dans un wrapper
 * `sm:hidden` par la page dashboard, qui lui passe des props déjà fetchées).
 * De haut en bas : recherche (ouvre la CommandPalette), grille des modules
 * actifs, puis cartes « à traiter » (à compléter, en attente, à confirmer) —
 * pas de widget de statistiques au-dessus de la grille (demande de Pierre).
 */
export function MobileHome({ pendingAmount, toConfirmCount, incomplete }: MobileHomeProps) {
  const { isActive } = useModules()

  // Tuiles = navItems de la Sidebar (source de vérité route + icône + module),
  // sans le Dashboard (on y est déjà), filtrées par modules actifs.
  // Paramètres n'a pas de moduleId → toujours visible.
  const tiles = navItems.filter(
    (item) => item.href !== "/" && (!item.moduleId || isActive(item.moduleId))
  )

  // Lignes « à compléter » — chacune gated par module actif côté client aussi.
  // Le tap ouvre le volet de complétion rapide (rendu par la page dashboard).
  const incompleteRows = [
    { label: "Contacts",             count: incomplete.contacts, moduleId: "contacts" as const },
    { label: "Sociétés",             count: incomplete.societes, moduleId: "societes" as const },
    { label: "Revenus",              count: incomplete.revenus,  moduleId: "revenus" as const },
    { label: "Dépenses récurrentes", count: incomplete.depenses, moduleId: "depenses" as const },
  ].filter((r) => r.count > 0 && isActive(r.moduleId))

  const showPending   = pendingAmount > 0 && (isActive("facturation") || isActive("revenus") || isActive("sante"))
  const showToConfirm = toConfirmCount > 0 && (isActive("taches") || isActive("projets") || isActive("calendrier"))

  return (
    <div className="space-y-5">
      {/* Recherche — ouvre la CommandPalette (mêmes fonctionnalités que ⌘K) */}
      <button
        type="button"
        onClick={() => window.dispatchEvent(new CustomEvent(OPEN_COMMAND_PALETTE_EVENT))}
        className="flex w-full items-center gap-3 rounded-xl border border-border/50 bg-card px-4 py-3 text-sm text-muted-foreground transition-colors active:bg-accent"
      >
        <Search className="h-4 w-4 shrink-0" />
        Rechercher…
      </button>

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

      {/* Cartes « à traiter » — sous la grille, uniquement si non vides */}
      {(incompleteRows.length > 0 || showPending || showToConfirm) && (
        <section className="space-y-1.5">
          <h2 className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            À traiter
          </h2>
          <div className="space-y-2">
            {incompleteRows.length > 0 && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 overflow-hidden">
                <p className="flex items-center gap-2 px-4 pt-3 pb-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Données à compléter
                </p>
                <div className="pb-1.5">
                  {incompleteRows.map((r) => (
                    <button
                      key={r.moduleId}
                      type="button"
                      onClick={() => window.dispatchEvent(new CustomEvent(OPEN_INCOMPLETE_SHEET_EVENT))}
                      className="flex w-full items-center gap-2 px-4 py-2 text-left transition-colors active:bg-amber-500/10"
                    >
                      <span className="flex-1 text-sm">{r.label}</span>
                      <span className="text-sm font-semibold tabular-nums text-amber-600">{r.count}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {showPending && (
              <InfoCard
                href="/revenus?filtre=attente"
                icon={<Hourglass className="h-4 w-4 text-amber-500" />}
                label="En attente de réception"
                value={`${pendingAmount.toLocaleString("fr-FR")} €`}
                valueClass="text-amber-600"
              />
            )}

            {showToConfirm && (
              <InfoCard
                href="/taches"
                icon={<CalendarCheck className="h-4 w-4 text-fuchsia-500" />}
                label="À confirmer"
                value={toConfirmCount}
                valueClass="text-fuchsia-600"
              />
            )}
          </div>
        </section>
      )}

      {/* Activation des push — visible uniquement si supporté et jamais demandé */}
      <PushNotificationsCard />
    </div>
  )
}

function InfoCard({
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
      className="flex items-center gap-3 rounded-xl border border-border/50 bg-card px-4 py-3 transition-colors active:bg-accent"
    >
      {icon}
      <span className="flex-1 text-sm font-medium">{label}</span>
      <span className={cn("text-sm font-bold tabular-nums", valueClass)}>{value}</span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  )
}
