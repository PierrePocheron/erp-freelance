"use client"

import { MODULE_DEFS, useModules } from "@/hooks/use-modules"

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
        {activeCount < MODULE_DEFS.length && (
          <button
            onClick={enableAll}
            className="shrink-0 text-xs text-primary hover:underline"
          >
            Tout activer
          </button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {MODULE_DEFS.map(mod => {
          const active = isActive(mod.id)
          return (
            <label
              key={mod.id}
              className={`flex items-start gap-3 rounded-lg border p-3.5 cursor-pointer transition-colors ${
                active
                  ? "border-primary/30 bg-primary/5"
                  : "border-border/50 hover:bg-muted/40"
              }`}
            >
              <input
                type="checkbox"
                checked={active}
                onChange={() => toggle(mod.id)}
                className="mt-0.5 h-4 w-4 rounded accent-primary"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
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

      <p className="text-xs text-muted-foreground/60">
        Les préférences sont enregistrées localement dans ce navigateur.
        Le contenu des modules désactivés reste intact — il est simplement masqué.
      </p>
    </div>
  )
}
