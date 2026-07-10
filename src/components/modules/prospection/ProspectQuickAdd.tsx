"use client"

import { useState, useTransition } from "react"
import { createProspect } from "@/actions/prospection"
import { Plus, X, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const SOURCE_OPTIONS = [
  { value: "WORD_OF_MOUTH", label: "Bouche à oreille" },
  { value: "LINKEDIN",      label: "LinkedIn" },
  { value: "WEBSITE",       label: "Site web" },
  { value: "INBOUND",       label: "Entrant" },
  { value: "OTHER",         label: "Autre" },
]

/**
 * Ajout rapide d'un prospect. Le point d'entrée du démarchage est le SITE
 * (nom + URL trouvés en scrapant) — le contact humain vient plus tard, donc
 * les deux champs principaux sont Nom du site et URL.
 */
export function ProspectQuickAdd() {
  const [quickName, setQuickName] = useState("")
  const [quickUrl, setQuickUrl] = useState("")
  const [quickEmail, setQuickEmail] = useState("")
  const [quickSource, setQuickSource] = useState("WEBSITE")
  const [showExtended, setShowExtended] = useState(false)
  const [batchMode, setBatchMode] = useState(false)
  const [isAdding, startAdding] = useTransition()

  function handleQuickAdd(e: React.FormEvent) {
    e.preventDefault()
    const name = quickName.trim()
    if (!name) return
    startAdding(async () => {
      await createProspect({
        name,
        websiteUrl: quickUrl.trim() || undefined,
        email: quickEmail.trim() || undefined,
        source: quickSource,
      })
      setQuickName("")
      setQuickUrl("")
      setQuickEmail("")
      setQuickSource("WEBSITE")
      setShowExtended(false)
      toast.success(`Prospect "${name}" ajouté`)
    })
  }

  if (batchMode) {
    return (
      <BatchAdd
        onClose={() => setBatchMode(false)}
        onDone={(count) => {
          setBatchMode(false)
          toast.success(`${count} prospect${count > 1 ? "s" : ""} ajouté${count > 1 ? "s" : ""}`)
        }}
      />
    )
  }

  return (
    <form onSubmit={handleQuickAdd} className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          value={quickName}
          onChange={(e) => setQuickName(e.target.value)}
          placeholder="Nom du site / de l'entreprise…"
          disabled={isAdding}
          className="flex-1 h-8 rounded-lg border border-input bg-transparent px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
        />
        <input
          value={quickUrl}
          onChange={(e) => setQuickUrl(e.target.value)}
          placeholder="URL du site…"
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

// ── Ajout en lot ───────────────────────────────────────────────────────────────

const BATCH_FIELDS: { key: string; label: string; required?: boolean }[] = [
  { key: "name",  label: "Nom du site", required: true },
  { key: "url",   label: "URL" },
  { key: "email", label: "Email" },
  { key: "source", label: "Source" },
]

type PendingProspect = { name: string; websiteUrl?: string; email?: string; source: string }

const SOURCES = ["WORD_OF_MOUTH", "LINKEDIN", "WEBSITE", "INBOUND", "OTHER"]

/** Transforme une ligne `Nom, URL, Email, Source` (champs skippables) en prospect. */
function parseLine(line: string): PendingProspect | null {
  const [name, url, email, source] = line.split(",").map((s) => s.trim())
  if (!name) return null
  return {
    name,
    websiteUrl: url || undefined,
    email: email || undefined,
    source: SOURCES.includes((source ?? "").toUpperCase()) ? source!.toUpperCase() : "WEBSITE",
  }
}

/**
 * Saisie en lot façon tags : champs séparés par des virgules (une virgule vide
 * = champ sauté), indicateur du champ en cours, Entrée = valide le prospect
 * en badge et passe au suivant. Le lot n'est créé qu'au clic final.
 */
function BatchAdd({ onClose, onDone }: { onClose: () => void; onDone: (count: number) => void }) {
  const [input, setInput] = useState("")
  const [pending, setPending] = useState<PendingProspect[]>([])
  const [isAdding, startAdding] = useTransition()

  // Champ en cours = nombre de virgules déjà tapées (plafonné au dernier champ)
  const activeField = Math.min(input.split(",").length - 1, BATCH_FIELDS.length - 1)

  function commitLine() {
    const parsed = parseLine(input)
    if (!parsed) return
    setPending((prev) => [...prev, parsed])
    setInput("")
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault()
      commitLine()
    } else if (e.key === "Backspace" && input === "" && pending.length > 0) {
      // Champ vide → backspace retire le dernier badge (comme les tags GitHub)
      setPending((prev) => prev.slice(0, -1))
    }
  }

  // Coller plusieurs lignes = un prospect par ligne
  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text")
    if (!text.includes("\n")) return
    e.preventDefault()
    const parsed = text.split("\n").map(parseLine).filter((p): p is PendingProspect => p !== null)
    setPending((prev) => [...prev, ...parsed])
  }

  function handleSubmit() {
    // La ligne en cours de saisie compte aussi (pas besoin d'Entrée final)
    const current = parseLine(input)
    const all = current ? [...pending, current] : pending
    if (all.length === 0) return
    startAdding(async () => {
      for (const p of all) {
        await createProspect(p)
      }
      setPending([])
      setInput("")
      onDone(all.length)
    })
  }

  return (
    <div className="space-y-2 rounded-lg border border-primary/30 bg-muted/20 p-3">
      {/* Indicateur du champ en cours */}
      <div className="flex items-center gap-1 text-[10px]">
        {BATCH_FIELDS.map((f, i) => (
          <span key={f.key} className="flex items-center gap-1">
            {i > 0 && <span className="text-muted-foreground/40">,</span>}
            <span className={cn(
              "rounded px-1.5 py-0.5 font-medium transition-colors",
              i === activeField ? "bg-primary text-primary-foreground" : "text-muted-foreground/60"
            )}>
              {f.label}{f.required ? " *" : ""}
            </span>
          </span>
        ))}
        <span className="ml-auto text-muted-foreground/60">Entrée = prospect suivant · virgule vide = champ sauté</span>
      </div>

      {/* Badges des prospects en attente + input */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-input bg-background px-2 py-1.5 focus-within:ring-1 focus-within:ring-ring">
        {pending.map((p, i) => (
          <span
            key={`${p.name}-${i}`}
            title={[p.websiteUrl, p.email].filter(Boolean).join(" · ") || undefined}
            className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium"
          >
            {p.name}
            {p.websiteUrl && <span className="text-primary/60 max-w-[120px] truncate">· {p.websiteUrl.replace(/^https?:\/\//, "")}</span>}
            <button
              type="button"
              onClick={() => setPending((prev) => prev.filter((_, j) => j !== i))}
              className="hover:text-destructive transition-colors"
              title="Retirer"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={pending.length === 0 ? "Boulangerie Dupont, boulangerie-dupont.fr, contact@…" : ""}
          disabled={isAdding}
          autoFocus
          className="flex-1 min-w-[200px] h-7 bg-transparent text-sm placeholder:text-muted-foreground/50 focus:outline-none disabled:opacity-50"
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={isAdding}
          className="h-8 px-3 rounded-lg border border-input text-sm text-muted-foreground hover:bg-muted/50 transition-colors disabled:opacity-50"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isAdding || (pending.length === 0 && !parseLine(input))}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-40 hover:bg-primary/90 transition-colors"
        >
          {isAdding
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Plus className="h-3.5 w-3.5" />}
          {isAdding
            ? "Ajout…"
            : `Ajouter ${pending.length + (parseLine(input) ? 1 : 0) || ""}`.trim()}
        </button>
      </div>
    </div>
  )
}
