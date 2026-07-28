// Constantes partagées du module Compétences (libellés, échelles) — sans "use client".

export const SKILL_LEVELS = [
  { value: 0, label: "Aucune",   short: "—" },
  { value: 1, label: "Notions",  short: "Notions" },
  { value: 2, label: "Junior",   short: "Junior" },
  { value: 3, label: "Confirmé", short: "Confirmé" },
  { value: 4, label: "Avancé",   short: "Avancé" },
  { value: 5, label: "Expert",   short: "Expert" },
] as const

export function levelLabel(level: number): string {
  return SKILL_LEVELS.find((l) => l.value === level)?.label ?? `Niveau ${level}`
}

export const SKILL_STATUS_META: Record<string, { label: string; cls: string }> = {
  MASTERED:   { label: "Maîtrisée",   cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
  LEARNING:   { label: "En cours",    cls: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400" },
  TO_ACQUIRE: { label: "À acquérir",  cls: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400" },
}

export const SKILL_TYPE_META: Record<string, { label: string; icon: string }> = {
  HARD: { label: "Compétences techniques", icon: "🛠️" },
  SOFT: { label: "Soft skills",            icon: "🤝" },
}

export const PROJECT_SKILL_ROLE_META: Record<string, { label: string }> = {
  USED:       { label: "Utilisée" },
  TO_ACQUIRE: { label: "À acquérir via ce projet" },
}
