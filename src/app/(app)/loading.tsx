import { BentoSkeleton } from "@/components/layout/page-skeletons"

/**
 * Fallback du tableau de bord (et filet de sécurité de tout segment sans
 * `loading.tsx` propre). La page d'accueil enchaîne ~35 requêtes Neon : sans
 * frontière Suspense, l'ancienne page restait figée sans aucun retour visuel.
 */
export default function Loading() {
  return <BentoSkeleton kpis={4} />
}
