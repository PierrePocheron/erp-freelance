"use client"

import { useEffect, useState } from "react"
import { Sun, Moon } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Réglage du thème (clair / sombre). Même mécanisme que l'ancien bouton de la sidebar :
 * bascule la classe `dark` sur <html> + persiste dans localStorage("theme"). Le thème est
 * posé avant hydratation par le script inline du layout ; ici on ne fait que synchroniser
 * l'affichage puis basculer au clic.
 */
export function AppearanceSection() {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDark(document.documentElement.classList.contains("dark"))
  }, [])

  function set(next: boolean) {
    setDark(next)
    document.documentElement.classList.toggle("dark", next)
    localStorage.setItem("theme", next ? "dark" : "light")
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="text-base font-semibold">Apparence</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">Choisis le thème de l&apos;application.</p>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:max-w-xs">
        {([
          { key: false, label: "Clair", Icon: Sun },
          { key: true, label: "Sombre", Icon: Moon },
        ] as const).map(({ key, label, Icon }) => {
          const on = dark === key
          return (
            <button
              key={label}
              type="button"
              onClick={() => set(key)}
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
