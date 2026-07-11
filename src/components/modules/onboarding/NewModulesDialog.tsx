"use client"

import { useState } from "react"
import { Check, PartyPopper } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ModuleId, NewModulesInfo } from "@/hooks/use-modules"

/**
 * Annonce d'un ou plusieurs nouveaux modules apparus depuis la dernière visite.
 * Chaque module est présélectionné selon son `defaultActive`, l'utilisateur peut
 * ajuster avant de valider — ou fermer sans rien activer ("Plus tard").
 */
export function NewModulesDialog({
  info,
  onValidate,
}: {
  info: NewModulesInfo
  onValidate: (enabledIds: ModuleId[]) => void
}) {
  const [selected, setSelected] = useState<Set<ModuleId>>(
    () => new Set(info.modules.filter(m => m.defaultActive).map(m => m.id))
  )

  function toggle(id: ModuleId) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      {/* max-h + flex-col : sur mobile, une longue liste de modules scrolle
          au milieu au lieu d'être coupée (header et footer restent visibles) */}
      <div className="w-full max-w-lg max-h-[85dvh] flex flex-col rounded-2xl bg-background border border-border shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-border/50">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
              <PartyPopper className="h-4.5 w-4.5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight">
                {info.modules.length > 1 ? "Nouveaux modules" : "Nouveau module"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {info.fromVersion ? `Mise à jour v${info.fromVersion} → v${info.toVersion}` : `Version v${info.toVersion}`}
              </p>
            </div>
          </div>
        </div>

        {/* Modules */}
        <div className="px-6 py-4 space-y-2 overflow-y-auto">
          {info.modules.map((mod) => {
            const active = selected.has(mod.id)
            return (
              <button
                key={mod.id}
                type="button"
                onClick={() => toggle(mod.id)}
                className={cn(
                  "w-full flex items-start gap-3 rounded-xl border p-3 text-left transition-colors",
                  active ? "border-primary/40 bg-primary/5" : "border-border/50 hover:bg-muted/40"
                )}
              >
                <span className="text-lg leading-none mt-0.5">{mod.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{mod.label}</p>
                  <p className="text-xs text-muted-foreground leading-snug mt-0.5">{mod.description}</p>
                </div>
                <span className={cn(
                  "mt-0.5 flex h-4 w-4 items-center justify-center rounded border shrink-0 transition-colors",
                  active ? "border-primary bg-primary text-primary-foreground" : "border-input"
                )}>
                  {active && <Check className="h-3 w-3" />}
                </span>
              </button>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border/50 flex items-center justify-between gap-3">
          <p className="hidden sm:block text-xs text-muted-foreground/70">
            Modifiable à tout moment dans Paramètres
          </p>
          <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => onValidate([])}
            className="h-9 px-4 rounded-lg border border-input text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
          >
            Plus tard
          </button>
          <button
            onClick={() => onValidate([...selected])}
            className="h-9 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Valider
          </button>
          </div>
        </div>
      </div>
    </div>
  )
}
