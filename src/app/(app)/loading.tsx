/**
 * Squelette de navigation. Le layout enchaîne plusieurs allers-retours Neon à chaque
 * page et la racine est en force-dynamic : sans frontière Suspense, l'ancienne page
 * restait figée sans aucun retour visuel pendant le chargement.
 */
export default function AppLoading() {
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true" aria-live="polite">
      <div className="h-8 w-56 rounded-lg bg-muted" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl border border-border/50 bg-muted/40" />
        ))}
      </div>
      <div className="h-64 rounded-xl border border-border/50 bg-muted/30" />
      <span className="sr-only">Chargement…</span>
    </div>
  )
}
