"use client"

import { useMemo, useState } from "react"
import {
  User, Building2, Landmark, LayoutGrid, Plug, Database, Search, X,
} from "lucide-react"

// ── Catégories (style Réglages Apple) ─────────────────────────────────────────
// Chaque catégorie porte des mots-clés pour la recherche : on cherche dans le
// libellé, la description et les mots-clés (accents ignorés).

export type SectionId =
  | "profil" | "emetteurs" | "fiscalite" | "modules" | "integrations" | "donnees"

type SectionMeta = {
  id:          SectionId
  label:       string
  description: string
  icon:        React.ElementType
  iconBg:      string   // pastille colorée façon Réglages macOS
  keywords:    string[]
}

const SECTIONS: SectionMeta[] = [
  {
    id: "profil", label: "Profil & entreprise", icon: User, iconBg: "bg-blue-500",
    description: "Identité, coordonnées, numérotation et conditions",
    keywords: ["nom", "email", "siret", "adresse", "telephone", "site", "numerotation", "prefixe", "format", "devis", "facture", "conditions", "cgv", "logo", "couleur", "pdf", "iban", "bic"],
  },
  {
    id: "emetteurs", label: "Émetteurs", icon: Building2, iconBg: "bg-amber-500",
    description: "Vos sociétés émettrices de devis et factures",
    keywords: ["emetteur", "societe", "raison sociale", "forme juridique", "banque", "iban", "bic", "reglement", "mentions legales", "tva", "defaut"],
  },
  {
    id: "fiscalite", label: "Fiscalité & URSSAF", icon: Landmark, iconBg: "bg-violet-500",
    description: "Statut, fréquence de déclaration, taux et sources fiscales",
    keywords: ["impots", "urssaf", "taux", "cotisations", "cfp", "versement liberatoire", "acre", "bnc", "bic", "declaration", "trimestre", "mensuel", "auto entrepreneur", "micro", "sources fiscales", "bucket"],
  },
  {
    id: "modules", label: "Modules", icon: LayoutGrid, iconBg: "bg-emerald-500",
    description: "Activer ou masquer les modules de l'application",
    keywords: ["modules", "activer", "desactiver", "sante", "graph", "entretiens", "revenus", "calendrier", "onboarding"],
  },
  {
    id: "integrations", label: "Intégrations", icon: Plug, iconBg: "bg-sky-500",
    description: "Services connectés : Google Calendar",
    keywords: ["google", "calendar", "calendrier", "agenda", "synchronisation", "connexion", "oauth"],
  },
  {
    id: "donnees", label: "Données", icon: Database, iconBg: "bg-red-500",
    description: "Export de vos données et zone de danger",
    keywords: ["export", "csv", "zip", "sauvegarde", "telecharger", "suppression", "supprimer", "danger", "reinitialiser"],
  },
]

const normalize = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")

export function SettingsShell({ nodes }: { nodes: Record<SectionId, React.ReactNode> }) {
  const [active, setActive] = useState<SectionId>("profil")
  const [query, setQuery]   = useState("")

  const matching = useMemo(() => {
    const q = normalize(query.trim())
    if (!q) return SECTIONS
    return SECTIONS.filter(s =>
      normalize(s.label).includes(q) ||
      normalize(s.description).includes(q) ||
      s.keywords.some(k => normalize(k).includes(q))
    )
  }, [query])

  // En recherche, on affiche la 1ère section correspondante si l'active ne matche plus
  const visibleId = matching.some(s => s.id === active)
    ? active
    : matching[0]?.id ?? null

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start">

      {/* ── Colonne catégories ─────────────────────────────────────────────── */}
      <aside className="w-full lg:w-64 lg:sticky lg:top-6 shrink-0 space-y-3">
        {/* Recherche */}
        <div className="flex items-center gap-2 rounded-xl border border-input bg-card px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Rechercher un paramètre…"
            className="bg-transparent text-sm outline-none flex-1 min-w-0 placeholder:text-muted-foreground/50"
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-muted-foreground hover:text-foreground shrink-0">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Liste des catégories */}
        <nav className="rounded-xl border border-border bg-card p-1.5 space-y-0.5">
          {matching.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">
              Aucun paramètre ne correspond à « {query} »
            </p>
          )}
          {matching.map(s => {
            const Icon = s.icon
            const isActive = s.id === visibleId
            return (
              <button
                key={s.id}
                onClick={() => setActive(s.id)}
                className={`flex items-center gap-3 w-full rounded-lg px-2.5 py-2 text-left transition-colors ${
                  isActive ? "bg-accent" : "hover:bg-accent/50"
                }`}
              >
                <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${s.iconBg} shrink-0`}>
                  <Icon className="h-4 w-4 text-white" />
                </span>
                <span className="min-w-0">
                  <span className={`block text-sm truncate ${isActive ? "font-semibold" : "font-medium"}`}>
                    {s.label}
                  </span>
                  <span className="block text-[11px] text-muted-foreground truncate">
                    {s.description}
                  </span>
                </span>
              </button>
            )
          })}
        </nav>
      </aside>

      {/* ── Contenu de la catégorie active ─────────────────────────────────── */}
      {/* Toutes les sections restent montées (masquées en CSS) : changer de
          catégorie ne détruit pas un formulaire en cours d'édition — ses
          modifications non enregistrées survivent à l'aller-retour. */}
      <div className="flex-1 min-w-0 w-full">
        {SECTIONS.map((s) => (
          <div key={s.id} hidden={s.id !== visibleId} className="space-y-6">
            {nodes[s.id]}
          </div>
        ))}
        {!visibleId && (
          <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            Essayez un autre terme de recherche.
          </div>
        )}
      </div>
    </div>
  )
}
