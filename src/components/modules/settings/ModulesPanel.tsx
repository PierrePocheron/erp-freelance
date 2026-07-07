"use client"

import { MODULE_DEFS, CATEGORY_ORDER, CATEGORY_META, useModules } from "@/hooks/use-modules"
import { OPEN_ONBOARDING_EVENT } from "@/components/modules/onboarding/OnboardingGate"
import { Sparkles } from "lucide-react"

export function ModulesPanel() {
  const { isActive, toggle, enableAll } = useModules()

  const activeCount = MODULE_DEFS.filter(m => isActive(m.id)).length

  return (
    <div className="rounded-xl border border-border/50 bg-card p-6 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold text-sm">Modules actifs</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Activez uniquement les fonctionnalités dont vous avez besoin.
            Les modules désactivés disparaissent de la navigation.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => window.dispatchEvent(new Event(OPEN_ONBOARDING_EVENT))}
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <Sparkles className="h-3 w-3" /> Revoir l&apos;initialisation
          </button>
          {activeCount < MODULE_DEFS.length && (
            <button onClick={enableAll} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Tout activer
            </button>
          )}
        </div>
      </div>

      {CATEGORY_ORDER.map((cat) => {
        const mods = MODULE_DEFS.filter((m) => m.category === cat)
        if (mods.length === 0) return null
        const meta = CATEGORY_META[cat]
        return (
          <div key={cat} className="space-y-2">
            <div className="flex items-baseline gap-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{meta.label}</h3>
              {cat === "bonus" && (
                <span className="text-[10px] text-muted-foreground/50">facultatif</span>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {mods.map(mod => {
                const active = isActive(mod.id)
                return (
                  <label
                    key={mod.id}
                    className={`flex items-start gap-3 rounded-lg border p-3.5 cursor-pointer transition-colors ${
                      active ? "border-primary/30 bg-primary/5" : "border-border/50 hover:bg-muted/40"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={() => toggle(mod.id)}
                      className="mt-0.5 h-4 w-4 rounded accent-primary"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base leading-none">{mod.icon}</span>
                        <span className="text-sm font-medium">{mod.label}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 leading-snug">
                        {mod.description}
                      </p>
                    </div>
                  </label>
                )
              })}
            </div>
          </div>
        )
      })}

      <p className="text-xs text-muted-foreground/60">
        Les préférences sont enregistrées localement dans ce navigateur.
        Le contenu des modules désactivés reste intact — il est simplement masqué.
      </p>
    </div>
  )
}
