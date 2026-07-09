"use client"

import { useState, useTransition } from "react"
import { createProspect } from "@/actions/prospection"
import { Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const SOURCE_OPTIONS = [
  { value: "WORD_OF_MOUTH", label: "Bouche à oreille" },
  { value: "LINKEDIN",      label: "LinkedIn" },
  { value: "WEBSITE",       label: "Site web" },
  { value: "INBOUND",       label: "Entrant" },
  { value: "OTHER",         label: "Autre" },
]

/** Ajout rapide d'un prospect (simple ou en lot texte) — repris de l'ancien ProspectsView. */
export function ProspectQuickAdd() {
  const [quickName, setQuickName] = useState("")
  const [quickEmail, setQuickEmail] = useState("")
  const [quickSource, setQuickSource] = useState("OTHER")
  const [showExtended, setShowExtended] = useState(false)
  const [batchMode, setBatchMode] = useState(false)
  const [batchText, setBatchText] = useState("")
  const [isAdding, startAdding] = useTransition()

  function handleQuickAdd(e: React.FormEvent) {
    e.preventDefault()
    const name = quickName.trim()
    if (!name) return
    startAdding(async () => {
      await createProspect({ name, email: quickEmail.trim() || undefined, source: quickSource })
      setQuickName("")
      setQuickEmail("")
      setQuickSource("OTHER")
      setShowExtended(false)
      toast.success(`Prospect "${name}" ajouté`)
    })
  }

  /** Parse le batch: une ligne = `Nom | Email? | Source?` */
  function parseBatchLines() {
    return batchText
      .split("\n")
      .map((line) => {
        const parts = line.split("|").map((s) => s.trim())
        const name = parts[0] ?? ""
        const email = parts[1] && parts[1].includes("@") ? parts[1] : undefined
        const src   = parts[2]?.toUpperCase() ?? "OTHER"
        const source = ["WORD_OF_MOUTH", "LINKEDIN", "WEBSITE", "INBOUND", "OTHER"].includes(src) ? src : "OTHER"
        return { name, email, source }
      })
      .filter((p) => p.name.length > 0)
  }

  function handleBatchAdd(e: React.FormEvent) {
    e.preventDefault()
    const lines = parseBatchLines()
    if (lines.length === 0) return
    startAdding(async () => {
      for (const { name, email, source } of lines) {
        await createProspect({ name, email, source })
      }
      setBatchText("")
      setBatchMode(false)
      toast.success(`${lines.length} prospect${lines.length > 1 ? "s" : ""} ajouté${lines.length > 1 ? "s" : ""}`)
    })
  }

  if (batchMode) {
    return (
      <form onSubmit={handleBatchAdd} className="space-y-2">
        <textarea
          value={batchText}
          onChange={(e) => setBatchText(e.target.value)}
          placeholder={"Jean Dupont\nMarie Martin | marie@martin.fr | LINKEDIN\nSociété XYZ | contact@xyz.fr"}
          disabled={isAdding}
          rows={4}
          autoFocus
          className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 resize-none font-mono text-xs leading-relaxed"
        />
        {parseBatchLines().length > 0 && (
          <p className="text-xs text-muted-foreground pl-0.5">
            {parseBatchLines().length} prospect{parseBatchLines().length > 1 ? "s" : ""} à importer
          </p>
        )}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { setBatchMode(false); setBatchText("") }}
            className="h-8 px-3 rounded-lg border border-input text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={isAdding || parseBatchLines().length === 0}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-40 hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            {isAdding ? "Import…" : `Importer ${parseBatchLines().length > 0 ? parseBatchLines().length : ""}`.trim()}
          </button>
          <p className="text-[10px] text-muted-foreground/60 ml-auto">Format : Nom | Email | Source</p>
        </div>
      </form>
    )
  }

  return (
    <form onSubmit={handleQuickAdd} className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          value={quickName}
          onChange={(e) => setQuickName(e.target.value)}
          placeholder="Nom du prospect…"
          disabled={isAdding}
          className="flex-1 h-8 rounded-lg border border-input bg-transparent px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
        />
        <button
          type="button"
          onClick={() => setShowExtended((v) => !v)}
          title={showExtended ? "Masquer les options" : "Plus d'options (email, source)"}
          className={cn(
            "h-8 w-8 flex items-center justify-center rounded-lg border text-xs transition-colors shrink-0",
            showExtended
              ? "border-primary/50 bg-primary/10 text-primary"
              : "border-input text-muted-foreground hover:border-foreground/30 hover:text-foreground"
          )}
        >
          ···
        </button>
        <button
          type="button"
          onClick={() => setBatchMode(true)}
          title="Importer plusieurs prospects en lot"
          className="h-8 px-2.5 rounded-lg border border-input text-xs text-muted-foreground hover:border-foreground/30 hover:text-foreground transition-colors shrink-0 whitespace-nowrap"
        >
          En lot
        </button>
        <button
          type="submit"
          disabled={isAdding || !quickName.trim()}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-40 hover:bg-primary/90 transition-colors shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
          {isAdding ? "Ajout…" : "Ajouter"}
        </button>
      </div>

      {showExtended && (
        <div className="flex items-center gap-2">
          <input
            value={quickEmail}
            onChange={(e) => setQuickEmail(e.target.value)}
            placeholder="Email (optionnel)"
            type="email"
            disabled={isAdding}
            className="flex-1 h-8 rounded-lg border border-input bg-transparent px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
          />
          <select
            value={quickSource}
            onChange={(e) => setQuickSource(e.target.value)}
            disabled={isAdding}
            className="h-8 rounded-lg border border-input bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
          >
            {SOURCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      )}
    </form>
  )
}
