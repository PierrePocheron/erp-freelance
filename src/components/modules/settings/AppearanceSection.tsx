"use client"

import { useEffect, useState } from "react"
import { Sun, Moon, Monitor } from "lucide-react"
import { cn } from "@/lib/utils"

type ThemeChoice = "light" | "dark" | "system"

/**
 * Réglage du thème : clair, sombre, ou « Système » (suit la préférence de
 * l'appareil). Sans choix enregistré, c'est « Système » qui s'applique — d'où un
 * thème sombre imposé sur un appareil réglé en sombre, sans que rien ne dise
 * qu'on pouvait en sortir. Les trois options sont maintenant explicites.
 *
 * Le thème est posé avant hydratation par le script inline du layout
 * (`theme-init-script.ts`), qui lit localStorage("theme") : absent = système.
 * Ce composant ne change pas ce script (donc pas son hash CSP) ; il écrit ou
 * efface la clé, puis applique la classe tout de suite.
 */
export function AppearanceSection() {
  const [choice, setChoice] = useState<ThemeChoice>("system")

  useEffect(() => {
    let stored: string | null = null
    try { stored = localStorage.getItem("theme") } catch { /* stockage indisponible */ }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChoice(stored === "light" || stored === "dark" ? stored : "system")
  }, [])

  function apply(next: ThemeChoice) {
    setChoice(next)
    try {
      if (next === "system") localStorage.removeItem("theme")
      else localStorage.setItem("theme", next)
    } catch { /* stockage indisponible : le choix vaut pour la session */ }
    const dark = next === "dark" || (next === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)
    document.documentElement.classList.toggle("dark", dark)
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="text-base font-semibold">Apparence</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Choisis le thème de l&apos;application. « Système » suit le réglage de l&apos;appareil ; le choix est mémorisé
        sur cet appareil.
      </p>
      <div className="mt-4 grid grid-cols-3 gap-2 sm:max-w-sm">
        {([
          { key: "light", label: "Clair", Icon: Sun },
          { key: "dark", label: "Sombre", Icon: Moon },
          { key: "system", label: "Système", Icon: Monitor },
        ] as const).map(({ key, label, Icon }) => {
          const on = choice === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => apply(key)}
              aria-pressed={on}
              className={cn(
                "flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors",
                on ? "border-primary bg-accent font-medium text-foreground" : "border-border text-muted-foreground hover:bg-accent/50",
              )}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
