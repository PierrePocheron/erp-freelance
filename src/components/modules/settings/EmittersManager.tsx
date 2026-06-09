"use client"

import { useState, useRef, useTransition } from "react"
import { Building2, Plus, Pencil, Trash2, Star, Loader2, Upload, X, MapPin, CreditCard } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  createEmitter, updateEmitter, deleteEmitter, setDefaultEmitter, type EmitterData,
} from "@/actions/emitter"

export type Emitter = {
  id: string
  name: string
  companyName: string | null
  legalForm: string | null
  siret: string | null
  vatNumber: string | null
  address: string | null
  postalCode: string | null
  city: string | null
  country: string | null
  phone: string | null
  email: string | null
  website: string | null
  iban: string | null
  bic: string | null
  defaultConditions: string | null
  legalMentions: string | null
  pdfAccentColor: string
  logoUrl: string | null
  isDefault: boolean
}

const ACCENT_PRESETS = ["#6366f1", "#8b5cf6", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#1a1a1a"]

export function EmittersManager({ emitters }: { emitters: Emitter[] }) {
  const [editing, setEditing] = useState<Emitter | null>(null)
  const [creating, setCreating] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSetDefault(id: string) {
    startTransition(() => setDefaultEmitter(id))
  }

  function handleDelete(e: Emitter) {
    if (!confirm(`Supprimer la société « ${e.name} » ? Les devis/factures émis sous ce profil seront détachés (non supprimés).`)) return
    startTransition(() => deleteEmitter(e.id))
  }

  return (
    <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-foreground">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold text-sm">Mes sociétés</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-1 ml-6">
            Émetteurs de vos devis et factures. La société par défaut est pré-sélectionnée à la création d&apos;un document.
          </p>
        </div>
        <Button type="button" size="sm" onClick={() => setCreating(true)} disabled={isPending}>
          <Plus className="h-4 w-4 mr-1.5" />
          Ajouter
        </Button>
      </div>

      {emitters.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          Aucune société. Ajoutez-en une pour émettre vos documents.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {emitters.map((e) => (
            <div key={e.id} className="rounded-lg border border-border/60 p-3.5 space-y-2 relative">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{e.name}</span>
                    {e.isDefault && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 text-amber-600 border border-amber-500/20 px-2 py-0.5 text-[10px] font-medium shrink-0">
                        <Star className="h-2.5 w-2.5 fill-current" /> Par défaut
                      </span>
                    )}
                  </div>
                  {e.companyName && e.companyName !== e.name && (
                    <p className="text-xs text-muted-foreground truncate">{e.companyName}</p>
                  )}
                </div>
                <span className="h-3 w-3 rounded-full shrink-0 mt-1" style={{ backgroundColor: e.pdfAccentColor }} />
              </div>

              <div className="space-y-1 text-xs text-muted-foreground">
                {(e.city || e.postalCode) && (
                  <p className="flex items-center gap-1.5"><MapPin className="h-3 w-3 shrink-0" />{[e.postalCode, e.city].filter(Boolean).join(" ")}</p>
                )}
                {e.siret && <p className="font-mono">SIRET {e.siret}</p>}
                {e.iban && <p className="flex items-center gap-1.5"><CreditCard className="h-3 w-3 shrink-0" />{e.iban}</p>}
              </div>

              <div className="flex items-center gap-1 pt-1">
                <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setEditing(e)}>
                  <Pencil className="h-3 w-3 mr-1" /> Éditer
                </Button>
                {!e.isDefault && (
                  <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => handleSetDefault(e.id)} disabled={isPending}>
                    <Star className="h-3 w-3 mr-1" /> Par défaut
                  </Button>
                )}
                <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs text-destructive hover:text-destructive ml-auto" onClick={() => handleDelete(e)} disabled={isPending}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <EmitterEditorDialog
          emitter={editing}
          onClose={() => { setCreating(false); setEditing(null) }}
        />
      )}
    </div>
  )
}

function EmitterEditorDialog({ emitter, onClose }: { emitter: Emitter | null; onClose: () => void }) {
  const isEdit = !!emitter
  const [accentColor, setAccentColor] = useState(emitter?.pdfAccentColor ?? "#6366f1")
  const [logoUrl, setLogoUrl] = useState<string | null>(emitter?.logoUrl ?? null)
  const [logoUploading, setLogoUploading] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)

  function handleLogoUpload(ev: React.ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { alert("Image trop grande (max 2 Mo)"); return }
    setLogoUploading(true)
    const reader = new FileReader()
    reader.onload = (e) => { setLogoUrl(e.target?.result as string); setLogoUploading(false) }
    reader.onerror = () => setLogoUploading(false)
    reader.readAsDataURL(file)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    const data: EmitterData = {
      name: (fd.get("name") as string)?.trim(),
      companyName: (fd.get("companyName") as string) || null,
      legalForm: (fd.get("legalForm") as string) || null,
      siret: (fd.get("siret") as string) || null,
      vatNumber: (fd.get("vatNumber") as string) || null,
      address: (fd.get("address") as string) || null,
      postalCode: (fd.get("postalCode") as string) || null,
      city: (fd.get("city") as string) || null,
      country: (fd.get("country") as string) || null,
      phone: (fd.get("phone") as string) || null,
      email: (fd.get("email") as string) || null,
      website: (fd.get("website") as string) || null,
      iban: (fd.get("iban") as string) || null,
      bic: (fd.get("bic") as string) || null,
      defaultConditions: (fd.get("defaultConditions") as string) || null,
      legalMentions: (fd.get("legalMentions") as string) || null,
      pdfAccentColor: accentColor,
      logoUrl,
    }
    if (!data.name) { setError("Le nom du profil est requis"); return }
    startTransition(async () => {
      try {
        if (isEdit) await updateEmitter(emitter!.id, data)
        else await createEmitter(data)
        onClose()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement")
      }
    })
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifier la société" : "Nouvelle société"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5 pt-2" autoComplete="off">
          {/* Identité */}
          <section className="space-y-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">Identité</h3>
            <div className="space-y-1.5">
              <Label>Nom du profil *</Label>
              <Input name="name" defaultValue={emitter?.name ?? ""} placeholder="Ex. Pedro Agency" required autoComplete="off" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Raison sociale</Label>
                <Input name="companyName" defaultValue={emitter?.companyName ?? ""} placeholder="Pedro SAS" autoComplete="off" />
              </div>
              <div className="space-y-1.5">
                <Label>Forme juridique</Label>
                <Input name="legalForm" defaultValue={emitter?.legalForm ?? ""} placeholder="SASU, EI, micro…" autoComplete="off" />
              </div>
              <div className="space-y-1.5">
                <Label>SIRET</Label>
                <Input name="siret" defaultValue={emitter?.siret ?? ""} placeholder="123 456 789 00012" className="font-mono" autoComplete="off" />
              </div>
              <div className="space-y-1.5">
                <Label>N° TVA intracom.</Label>
                <Input name="vatNumber" defaultValue={emitter?.vatNumber ?? ""} placeholder="FR12345678901" className="font-mono" autoComplete="off" />
              </div>
            </div>
          </section>

          {/* Coordonnées */}
          <section className="space-y-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">Coordonnées</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Téléphone</Label>
                <Input name="phone" defaultValue={emitter?.phone ?? ""} placeholder="+33 6 12 34 56 78" autoComplete="off" />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input name="email" type="email" defaultValue={emitter?.email ?? ""} placeholder="contact@pedro.fr" autoComplete="off" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Site web</Label>
                <Input name="website" defaultValue={emitter?.website ?? ""} placeholder="https://pedro.fr" autoComplete="off" />
              </div>
            </div>
          </section>

          {/* Adresse */}
          <section className="space-y-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">Adresse</h3>
            <div className="space-y-1.5">
              <Label>Adresse</Label>
              <Input name="address" defaultValue={emitter?.address ?? ""} placeholder="12 rue de la Paix" autoComplete="off" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Code postal</Label>
                <Input name="postalCode" defaultValue={emitter?.postalCode ?? ""} placeholder="75001" autoComplete="off" />
              </div>
              <div className="space-y-1.5">
                <Label>Ville</Label>
                <Input name="city" defaultValue={emitter?.city ?? ""} placeholder="Paris" autoComplete="off" />
              </div>
              <div className="space-y-1.5">
                <Label>Pays</Label>
                <Input name="country" defaultValue={emitter?.country ?? "France"} placeholder="France" autoComplete="off" />
              </div>
            </div>
          </section>

          {/* Banque */}
          <section className="space-y-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">Coordonnées bancaires</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>IBAN</Label>
                <Input name="iban" defaultValue={emitter?.iban ?? ""} placeholder="FR76 3000 6000 0112 3456 7890 189" className="font-mono" autoComplete="off" />
              </div>
              <div className="space-y-1.5">
                <Label>BIC</Label>
                <Input name="bic" defaultValue={emitter?.bic ?? ""} placeholder="BNPAFRPP" className="font-mono" autoComplete="off" />
              </div>
            </div>
          </section>

          {/* Branding PDF */}
          <section className="space-y-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">Branding PDF</h3>
            <div className="space-y-1.5">
              <Label>Logo</Label>
              <div className="flex items-center gap-3">
                {logoUrl ? (
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logoUrl} alt="Logo" className="h-12 w-auto object-contain rounded border border-border bg-white p-1" />
                    <button type="button" onClick={() => setLogoUrl(null)} className="absolute -top-1.5 -right-1.5 rounded-full bg-destructive text-destructive-foreground p-0.5">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div className="h-12 w-24 rounded border border-dashed border-border bg-muted/30 flex items-center justify-center text-xs text-muted-foreground">Aucun logo</div>
                )}
                <div>
                  <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                  <Button type="button" variant="outline" size="sm" disabled={logoUploading} onClick={() => logoInputRef.current?.click()}>
                    {logoUploading ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Envoi…</> : <><Upload className="h-3.5 w-3.5 mr-1.5" />Changer le logo</>}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-1">PNG, SVG ou JPG — max 2 Mo</p>
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Couleur d&apos;accentuation</Label>
              <div className="flex items-center gap-2 flex-wrap">
                {ACCENT_PRESETS.map((c) => (
                  <button key={c} type="button" title={c} onClick={() => setAccentColor(c)}
                    className="h-7 w-7 rounded-full border-2 transition-all"
                    style={{ backgroundColor: c, borderColor: accentColor === c ? c : "transparent", boxShadow: accentColor === c ? `0 0 0 2px white, 0 0 0 4px ${c}` : "none" }} />
                ))}
                <label title="Couleur personnalisée" className="h-7 w-7 rounded-full border-2 border-dashed border-border flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors cursor-pointer shrink-0">
                  <Plus className="h-3.5 w-3.5 pointer-events-none" />
                  <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="sr-only" />
                </label>
                <span className="text-sm font-bold ml-1" style={{ color: accentColor }}>DEVIS</span>
              </div>
            </div>
          </section>

          {/* Légal & CGV */}
          <section className="space-y-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">Légal & conditions</h3>
            <div className="space-y-1.5">
              <Label>Conditions générales par défaut</Label>
              <textarea name="defaultConditions" rows={2} defaultValue={emitter?.defaultConditions ?? ""} placeholder="CGV pré-remplies à la création d'un devis…" className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none" />
            </div>
            <div className="space-y-1.5">
              <Label>Mentions légales</Label>
              <textarea name="legalMentions" rows={2} defaultValue={emitter?.legalMentions ?? ""} placeholder="Mentions de bas de page (TVA non applicable art. 293 B, etc.)…" className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none" />
            </div>
          </section>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Enregistrement…</> : (isEdit ? "Enregistrer" : "Créer la société")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
