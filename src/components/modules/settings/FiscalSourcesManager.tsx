"use client"

import { useState, useTransition } from "react"
import { Wallet, Plus, Pencil, Trash2, Link2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  createFiscalSource, updateFiscalSource, deleteFiscalSource, linkEmitterToFiscalSource,
} from "@/actions/fiscal-source"

// ── Types ──────────────────────────────────────────────────────────────────────

export type FiscalSourceItem = {
  id:       string
  name:     string
  bucket:   string
  color:    string
  isActive: boolean
  notes:    string | null
  emitterProfiles: { id: string; name: string; companyName: string | null }[]
  _count:   { revenues: number }
}

export type EmitterSummary = {
  id:          string
  name:        string
  companyName: string | null
  fiscalSourceId: string | null
}

// ── Constants ──────────────────────────────────────────────────────────────────

const BUCKET_LABELS: Record<string, string> = {
  AE_URSSAF:     "AE — Déclaré URSSAF",
  NON_IMPOSABLE: "Non imposable (études, baby-sitting…)",
  OTHER:         "Autre",
}

const BUCKET_COLORS: Record<string, string> = {
  AE_URSSAF:     "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  NON_IMPOSABLE: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  OTHER:         "bg-slate-500/15 text-slate-600 dark:text-slate-400",
}

const COLOR_PRESETS = [
  "#f59e0b", "#10b981", "#6366f1", "#ef4444",
  "#8b5cf6", "#0ea5e9", "#ec4899", "#1a1a1a",
]

// ── Dialog form ────────────────────────────────────────────────────────────────

function SourceForm({
  initial,
  onClose,
}: {
  initial?: FiscalSourceItem
  onClose: () => void
}) {
  const [name,    setName]    = useState(initial?.name ?? "")
  const [bucket,  setBucket]  = useState(initial?.bucket ?? "OTHER")
  const [color,   setColor]   = useState(initial?.color ?? "#6366f1")
  const [notes,   setNotes]   = useState(initial?.notes ?? "")
  const [error,   setError]   = useState("")
  const [pending, start]      = useTransition()

  function handleSubmit() {
    if (!name.trim()) { setError("Le nom est requis"); return }
    setError("")
    start(async () => {
      if (initial) {
        await updateFiscalSource(initial.id, { name, bucket, color, notes: notes || null })
      } else {
        await createFiscalSource({ name, bucket, color, notes: notes || undefined })
      }
      onClose()
    })
  }

  return (
    <div className="space-y-4 pt-2">
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Nom *</label>
        <Input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="ex: Pedro Dev AE, Baby-sitting, Bourse INSA"
          className="h-9"
          autoFocus
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Catégorie fiscale *</label>
        <select
          value={bucket}
          onChange={e => setBucket(e.target.value)}
          className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {Object.entries(BUCKET_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Couleur (affichage graph)</label>
        <div className="flex items-center gap-2 flex-wrap">
          {COLOR_PRESETS.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={`h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 ${
                color === c ? "border-foreground scale-110" : "border-transparent"
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
          <input
            type="color"
            value={color}
            onChange={e => setColor(e.target.value)}
            className="h-6 w-6 cursor-pointer rounded border-0 p-0 bg-transparent"
            title="Couleur personnalisée"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Notes (optionnel)</label>
        <Input
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Remarques, contexte…"
          className="h-9"
        />
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={onClose} disabled={pending}>
          Annuler
        </Button>
        <Button size="sm" onClick={handleSubmit} disabled={pending}>
          {initial ? "Enregistrer" : "Créer"}
        </Button>
      </div>
    </div>
  )
}

// ── Link emitter dialog ────────────────────────────────────────────────────────

function LinkEmitterDialog({
  source,
  emitters,
  onClose,
}: {
  source: FiscalSourceItem
  emitters: EmitterSummary[]
  onClose: () => void
}) {
  const [pending, start] = useTransition()

  function handleLink(emitterId: string, linked: boolean) {
    start(async () => {
      await linkEmitterToFiscalSource(emitterId, linked ? source.id : null)
    })
  }

  return (
    <div className="space-y-4 pt-2">
      <p className="text-sm text-muted-foreground">
        Lie un profil émetteur à <strong>{source.name}</strong>. Les factures émises
        sous ce profil seront automatiquement rattachées à cette source fiscale.
      </p>

      <div className="space-y-2">
        {emitters.length === 0 && (
          <p className="text-xs text-muted-foreground italic">Aucun profil émetteur configuré.</p>
        )}
        {emitters.map(e => {
          const isLinked = e.fiscalSourceId === source.id
          return (
            <div
              key={e.id}
              className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
            >
              <div>
                <p className="text-sm font-medium">{e.companyName ?? e.name}</p>
                {e.companyName && <p className="text-xs text-muted-foreground">{e.name}</p>}
              </div>
              <button
                onClick={() => handleLink(e.id, !isLinked)}
                disabled={pending || (!!e.fiscalSourceId && !isLinked)}
                className={`text-xs rounded-md px-2.5 py-1 font-medium transition-colors ${
                  isLinked
                    ? "bg-primary/10 text-primary hover:bg-primary/20"
                    : e.fiscalSourceId && !isLinked
                    ? "text-muted-foreground cursor-not-allowed opacity-50"
                    : "bg-muted hover:bg-accent text-foreground"
                }`}
                title={
                  e.fiscalSourceId && !isLinked
                    ? "Ce profil est déjà lié à une autre source"
                    : undefined
                }
              >
                {isLinked ? "Délier" : "Lier"}
              </button>
            </div>
          )
        })}
      </div>

      <div className="flex justify-end pt-1">
        <Button variant="outline" size="sm" onClick={onClose}>
          Fermer
        </Button>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function FiscalSourcesManager({
  sources,
  emitters,
}: {
  sources:  FiscalSourceItem[]
  emitters: EmitterSummary[]
}) {
  const [creating,         setCreating]         = useState(false)
  const [editing,          setEditing]          = useState<FiscalSourceItem | null>(null)
  const [linking,          setLinking]          = useState<FiscalSourceItem | null>(null)
  const [confirmDeleteId,  setConfirmDeleteId]  = useState<string | null>(null)
  const [pending,          start]               = useTransition()

  function handleDelete(s: FiscalSourceItem) {
    start(async () => { await deleteFiscalSource(s.id); setConfirmDeleteId(null) })
  }

  return (
    <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold text-sm">Sources fiscales</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Catégorisez vos revenus pour le récapitulatif annuel (URSSAF, non imposables…)
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setCreating(true)}
          className="shrink-0 gap-1"
        >
          <Plus className="h-3.5 w-3.5" />
          Ajouter
        </Button>
      </div>

      {/* Liste */}
      {sources.length === 0 ? (
        <p className="text-xs text-muted-foreground italic text-center py-4">
          Aucune source fiscale configurée.
        </p>
      ) : (
        <div className="space-y-2">
          {sources.map(s => (
            <div
              key={s.id}
              className="flex items-start gap-3 rounded-lg border border-border/60 px-3 py-2.5"
            >
              {/* Color dot */}
              <span
                className="mt-0.5 h-3 w-3 rounded-full shrink-0 ring-2 ring-border"
                style={{ backgroundColor: s.color }}
              />

              <div className="flex-1 min-w-0 space-y-0.5">
                <p className="text-sm font-medium leading-tight">{s.name}</p>
                <span className={`inline-block text-[10px] font-medium rounded-full px-2 py-0.5 ${BUCKET_COLORS[s.bucket] ?? BUCKET_COLORS.OTHER}`}>
                  {BUCKET_LABELS[s.bucket] ?? s.bucket}
                </span>
                {s.emitterProfiles.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Émetteur lié : {s.emitterProfiles.map(e => e.companyName ?? e.name).join(", ")}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {s._count.revenues} revenu{s._count.revenues !== 1 ? "s" : ""}
                </p>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  title="Lier un profil émetteur"
                  onClick={() => setLinking(s)}
                  className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                  <Link2 className="h-3.5 w-3.5" />
                </button>
                <button
                  title="Modifier"
                  onClick={() => setEditing(s)}
                  className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                {confirmDeleteId === s.id ? (
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => handleDelete(s)} disabled={pending}
                      className="rounded-md px-2 py-1 text-[10px] font-medium text-destructive hover:bg-destructive/10 transition-colors">
                      Supprimer
                    </button>
                    <button onClick={() => setConfirmDeleteId(null)}
                      className="rounded-md px-2 py-1 text-[10px] text-muted-foreground hover:bg-accent transition-colors">
                      Annuler
                    </button>
                  </div>
                ) : (
                  <button
                    title="Supprimer"
                    onClick={() => setConfirmDeleteId(s.id)}
                    disabled={pending}
                    className="rounded-md p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Quick-add row */}
          <button
            onClick={() => setCreating(true)}
            className="w-full flex items-center gap-2 rounded-lg border border-dashed border-border/60 px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:border-border hover:bg-muted/40 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Nouvelle source fiscale
          </button>
        </div>
      )}

      {/* Dialog création */}
      <Dialog open={creating} onOpenChange={v => { if (!v) setCreating(false) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Wallet className="h-4 w-4" />
              Nouvelle source fiscale
            </DialogTitle>
          </DialogHeader>
          <SourceForm onClose={() => setCreating(false)} />
        </DialogContent>
      </Dialog>

      {/* Dialog édition */}
      <Dialog open={!!editing} onOpenChange={v => { if (!v) setEditing(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Pencil className="h-4 w-4" />
              Modifier la source
            </DialogTitle>
          </DialogHeader>
          {editing && <SourceForm initial={editing} onClose={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>

      {/* Dialog liaison émetteur */}
      <Dialog open={!!linking} onOpenChange={v => { if (!v) setLinking(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Link2 className="h-4 w-4" />
              Lier un profil émetteur
            </DialogTitle>
          </DialogHeader>
          {linking && (
            <LinkEmitterDialog
              source={linking}
              emitters={emitters}
              onClose={() => setLinking(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Standalone "+" button (used in other pages) ────────────────────────────────

export function AddFiscalSourceButton({ className }: { className?: string }) {
  const [creating, setCreating] = useState(false)

  return (
    <>
      <button
        onClick={() => setCreating(true)}
        title="Nouvelle source fiscale"
        className={className ?? "inline-flex items-center justify-center h-6 w-6 rounded-md border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-border/80 hover:bg-muted/40 transition-colors"}
      >
        <Plus className="h-3.5 w-3.5" />
      </button>

      <Dialog open={creating} onOpenChange={v => { if (!v) setCreating(false) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Wallet className="h-4 w-4" />
              Nouvelle source fiscale
            </DialogTitle>
          </DialogHeader>
          <SourceForm onClose={() => setCreating(false)} />
        </DialogContent>
      </Dialog>
    </>
  )
}
