// Constantes partagées du module Dépenses — dans un module NEUTRE (ni "use
// client" ni "use server") exprès : exportées depuis un composant client,
// elles deviendraient des références client dans les Server Components et
// s'y rendraient vides (bug historique du badge de fréquence).
export const FREQUENCY_LABELS: Record<string, string> = {
  WEEKLY: "Hebdomadaire",
  MONTHLY: "Mensuelle",
  QUARTERLY: "Trimestrielle",
  YEARLY: "Annuelle",
  CUSTOM: "Personnalisée",
}
