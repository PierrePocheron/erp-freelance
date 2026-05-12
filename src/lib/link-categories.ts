export const LINK_CATEGORY_CONFIG: Record<string, { label: string; cls: string; dot: string }> = {
  GITHUB:  { label: "GitHub",  cls: "bg-slate-500/15 text-slate-600 border-slate-500/25",    dot: "bg-slate-500" },
  LOCAL:   { label: "Local",   cls: "bg-orange-500/15 text-orange-600 border-orange-500/25", dot: "bg-orange-500" },
  PROD:    { label: "Prod",    cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/25", dot: "bg-emerald-500" },
  STAGING: { label: "Staging", cls: "bg-amber-500/15 text-amber-600 border-amber-500/25",    dot: "bg-amber-500" },
  DOCS:    { label: "Docs",    cls: "bg-blue-500/15 text-blue-600 border-blue-500/25",        dot: "bg-blue-500" },
  OTHER:   { label: "Autre",   cls: "bg-violet-500/15 text-violet-600 border-violet-500/25", dot: "bg-violet-500" },
}
