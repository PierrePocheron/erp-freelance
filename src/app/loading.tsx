import { Server } from "lucide-react"

/**
 * Écran de démarrage (fallback Suspense du segment racine).
 *
 * Le layout racine est synchrone, donc son HTML part immédiatement ; `(app)/layout.tsx`
 * attend `auth()` puis plusieurs allers-retours Neon avant de rendre le shell. Sans
 * frontière Suspense entre les deux, le premier affichage était un écran BLANC de
 * plusieurs secondes (le temps que Neon sorte de veille) — y compris au lancement de
 * la PWA. Ce fallback couvre aussi /login, qui attend la même session.
 *
 * Volontairement sans donnée : pas de requête, sinon il attendrait ce qu'il masque.
 * Le logo est celui de la sidebar (carré primaire + icône Server).
 */
export default function BootLoading() {
  return (
    <div
      className="flex h-full flex-col items-center justify-center gap-6 bg-background"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="relative flex items-center justify-center">
        {/* Halo qui respire derrière le logo (utilitaire natif, coupé si l'OS
            demande « réduire les animations »). */}
        <span
          aria-hidden
          className="absolute h-16 w-16 rounded-2xl bg-primary/20 motion-safe:animate-ping"
        />
        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg">
          <Server className="h-7 w-7 text-primary-foreground" />
        </div>
      </div>

      <div className="flex flex-col items-center gap-3">
        <p className="text-sm font-semibold tracking-tight">ERP Freelance</p>
        <div aria-hidden className="flex items-center gap-1.5">
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              className="h-1.5 w-1.5 rounded-full bg-primary/70 motion-safe:animate-bounce"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </div>
      </div>

      <span className="sr-only">Chargement de l&apos;application…</span>
    </div>
  )
}
