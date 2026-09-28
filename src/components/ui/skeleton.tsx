import { cn } from "@/lib/utils"

/**
 * Bloc gris pulsé — brique de base des écrans de chargement (`loading.tsx`).
 * Décoratif : toujours `aria-hidden`, c'est l'écran qui porte `aria-busy`.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("rounded-md bg-muted motion-safe:animate-pulse", className)} />
}
