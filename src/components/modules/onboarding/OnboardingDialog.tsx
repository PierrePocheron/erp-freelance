"use client"

import { useState } from "react"
import { Check, Sparkles, X } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  MODULE_DEFS, CATEGORY_ORDER, CATEGORY_META,
  type ModuleId, type ModuleCategory,
} from "@/hooks/use-modules"

/**
 * Écran d'initialisation : l'utilisateur choisit les modules qu'il souhaite activer,
 * regroupés par catégorie (essentiels / recommandés / bonus).
 * - mode "auto"   : première connexion (pas d'annulation, choix obligatoire).
 * - mode "manual" : relancé depuis les paramètres (annulable).
 */
export function OnboardingDialog({
  initialSelection,
  mode,
  onValidate,
  onCancel,
}: {
  initialSelection: ModuleId[]
  mode: "auto" | "manual"
  onValidate: (ids: ModuleId[]) => void
  onCancel?: () => void
}) {
  const [selected, setSelected] = useState<Set<ModuleId>>(() => new Set(initialSelection))

  function toggle(id: ModuleId) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const byCategory = (cat: ModuleCategory) => MODULE_DEFS.filter((m) => m.category === cat)

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-background border border-border shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-border/50 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                <Sparkles className="h-4.5 w-4.5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold tracking-tight">
                  {mode === "auto" ? "Bienvenue 👋" : "Vos modules"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {mode === "auto"
                    ? "Choisissez les modules à activer. Vous pourrez les modifier à tout moment dans les paramètres."
                    : "Activez ou désactivez les modules selon vos besoins."}
                </p>
              </div>
            </div>
            {mode === "manual" && onCancel && (
              <button onClick={onCancel} className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Catégories */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {CATEGORY_ORDER.map((cat) => {
            const mods = byCategory(cat)
            if (mods.length === 0) return null
            const meta = CATEGORY_META[cat]
            return (
              <section key={cat} className="space-y-2">
                <div className="flex items-baseline gap-2">
                  <h3 className="text-sm font-semibold">{meta.label}</h3>
                  {cat === "bonus" && (
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground/60">facultatif</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground -mt-1">{meta.description}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {mods.map((mod) => {
                    const active = selected.has(mod.id)
                    return (
                      <button
                        key={mod.id}
                        type="button"
                        onClick={() => toggle(mod.id)}
                        className={cn(
                          "flex items-start gap-3 rounded-xl border p-3 text-left transition-colors",
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
              </section>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border/50 flex items-center justify-between gap-3 shrink-0">
          <p className="text-xs text-muted-foreground">
            {selected.size} module{selected.size > 1 ? "s" : ""} sélectionné{selected.size > 1 ? "s" : ""}
          </p>
          <div className="flex items-center gap-2">
            {mode === "manual" && onCancel && (
              <button
                onClick={onCancel}
                className="h-9 px-4 rounded-lg border border-input text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
              >
                Annuler
              </button>
            )}
            <button
              onClick={() => onValidate([...selected])}
              className="h-9 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              {mode === "auto" ? "Commencer" : "Enregistrer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
