"use client"

import { useState, useRef } from "react"
import { saveProfile, updateAccentColors, type ProfileData } from "@/actions/settings"
import { type NumberFormat, FORMAT_OPTIONS, buildNumberPreview } from "@/lib/number-format"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { User, Building2, CreditCard, FileText, CheckCircle2, Loader2, Palette, Upload, X, Pencil, Plus, ScrollText } from "lucide-react"
import { ConditionsManager } from "./ConditionsManager"

type ConditionsTemplate = {
  id: string
  name: string
  content: string
  isDefault: boolean
}

type Props = {
  userId: string
  profile: ProfileData | null
  userName: string | null
  userEmail: string | null
  conditionsTemplates: ConditionsTemplate[]
}

const ACCENT_PRESETS = [
  { color: "#6366f1", label: "Indigo" },
  { color: "#8b5cf6", label: "Violet" },
  { color: "#0ea5e9", label: "Bleu" },
  { color: "#10b981", label: "Emeraude" },
  { color: "#f59e0b", label: "Ambre" },
  { color: "#ef4444", label: "Rouge" },
  { color: "#ec4899", label: "Rose" },
  { color: "#1a1a1a", label: "Noir" },
]


export function SettingsForm({ userId, profile, userName, userEmail, conditionsTemplates }: Props) {
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [accentColor, setAccentColor] = useState(profile?.pdfAccentColor ?? "#6366f1")
  const [logoUrl, setLogoUrl] = useState<string | null>(profile?.logoUrl ?? null)
  const [quotePrefix, setQuotePrefix] = useState(profile?.quotePrefix ?? "DEV")
  const [invoicePrefix, setInvoicePrefix] = useState(profile?.invoicePrefix ?? "FAC")
  const [quoteFormat, setQuoteFormat] = useState<NumberFormat>((profile?.quoteNumberFormat as NumberFormat) ?? "PREFIX-YYYY-NNN")
  const [invoiceFormat, setInvoiceFormat] = useState<NumberFormat>((profile?.invoiceNumberFormat as NumberFormat) ?? "PREFIX-YYYY-NNN")
  const [logoUploading, setLogoUploading] = useState(false)
  const [customColors, setCustomColors] = useState<string[]>(() => {
    try { return JSON.parse(profile?.customAccentColors ?? "[]") } catch { return [] }
  })
  const logoInputRef = useRef<HTMLInputElement>(null)
  const addingColor = useRef(false)

  function saveCustomColors(colors: string[]) {
    setCustomColors(colors)
    void updateAccentColors(userId, JSON.stringify(colors))
  }

  function handleAddColorChange(color: string) {
    if (!addingColor.current) {
      addingColor.current = true
      const next = [...customColors, color]
      saveCustomColors(next)
      setAccentColor(color)
    } else {
      const next = [...customColors.slice(0, -1), color]
      saveCustomColors(next)
      setAccentColor(color)
    }
  }

  function handleAddColorClose() {
    addingColor.current = false
  }

  function editCustomColor(idx: number, newColor: string) {
    const next = customColors.map((c, i) => (i === idx ? newColor : c))
    saveCustomColors(next)
    if (accentColor === customColors[idx]) setAccentColor(newColor)
  }

  function removeCustomColor(idx: number) {
    const next = customColors.filter((_, i) => i !== idx)
    saveCustomColors(next)
  }

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      alert("Image trop grande (max 2 Mo)")
      return
    }
    setLogoUploading(true)
    const reader = new FileReader()
    reader.onload = (ev) => {
      setLogoUrl(ev.target?.result as string)
      setLogoUploading(false)
    }
    reader.onerror = () => setLogoUploading(false)
    reader.readAsDataURL(file)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setStatus("saving")
    const fd = new FormData(e.currentTarget)
    try {
      await saveProfile(userId, {
        companyName: (fd.get("companyName") as string) || null,
        siret: (fd.get("siret") as string) || null,
        address: (fd.get("address") as string) || null,
        postalCode: (fd.get("postalCode") as string) || null,
        city: (fd.get("city") as string) || null,
        country: (fd.get("country") as string) || null,
        phone: (fd.get("phone") as string) || null,
        website: (fd.get("website") as string) || null,
        iban: (fd.get("iban") as string) || null,
        bic: (fd.get("bic") as string) || null,
        quotePrefix: (fd.get("quotePrefix") as string) || "DEV",
        invoicePrefix: (fd.get("invoicePrefix") as string) || "FAC",
        quoteNumberFormat: quoteFormat,
        invoiceNumberFormat: invoiceFormat,
        pdfAccentColor: accentColor,
        logoUrl,
      })
      setStatus("saved")
      setTimeout(() => setStatus("idle"), 3000)
    } catch {
      setStatus("error")
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Colonne gauche */}
        <div className="space-y-6">

      {/* Identité */}
      <Section icon={<User className="h-4 w-4" />} title="Identité">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Nom complet" hint="Modifiable via votre compte Google">
            <Input value={userName ?? ""} disabled className="h-8 bg-muted/40" readOnly />
          </Field>
          <Field label="Email">
            <Input value={userEmail ?? ""} disabled className="h-8 bg-muted/40" readOnly />
          </Field>
        </div>
        <Field label="Nom commercial / entreprise">
          <Input name="companyName" defaultValue={profile?.companyName ?? ""} placeholder="Agence SuperDev" className="h-8" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Téléphone">
            <Input name="phone" defaultValue={profile?.phone ?? ""} placeholder="+33 6 12 34 56 78" className="h-8" />
          </Field>
          <Field label="Site web">
            <Input name="website" defaultValue={profile?.website ?? ""} placeholder="https://monsite.fr" className="h-8" />
          </Field>
        </div>
      </Section>

      {/* Adresse & Légal */}
      <Section icon={<Building2 className="h-4 w-4" />} title="Adresse & Légal">
        <Field label="Adresse">
          <Input name="address" defaultValue={profile?.address ?? ""} placeholder="12 rue de la Paix" className="h-8" />
        </Field>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Code postal">
            <Input name="postalCode" defaultValue={profile?.postalCode ?? ""} placeholder="75001" className="h-8" />
          </Field>
          <Field label="Ville">
            <Input name="city" defaultValue={profile?.city ?? ""} placeholder="Paris" className="h-8" />
          </Field>
          <Field label="Pays">
            <Input name="country" defaultValue={profile?.country ?? "France"} placeholder="France" className="h-8" />
          </Field>
        </div>
        <Field label="SIRET">
          <Input name="siret" defaultValue={profile?.siret ?? ""} placeholder="123 456 789 00012" className="h-8 font-mono" />
        </Field>
      </Section>

      {/* Coordonnées bancaires */}
      <Section icon={<CreditCard className="h-4 w-4" />} title="Coordonnées bancaires" description="Affichées en bas des factures pour faciliter le paiement">
        <Field label="IBAN">
          <Input name="iban" defaultValue={profile?.iban ?? ""} placeholder="FR76 3000 6000 0112 3456 7890 189" className="h-8 font-mono" />
        </Field>
        <Field label="BIC">
          <Input name="bic" defaultValue={profile?.bic ?? ""} placeholder="BNPAFRPP" className="h-8 font-mono" />
        </Field>
      </Section>

        </div>{/* fin colonne gauche */}

        {/* Colonne droite */}
        <div className="space-y-6">

      {/* Numérotation */}
      <Section icon={<FileText className="h-4 w-4" />} title="Numérotation" description="Format et préfixes des numéros de documents">
        {/* Devis */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Devis</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Préfixe">
              <Input
                name="quotePrefix"
                value={quotePrefix}
                onChange={(e) => setQuotePrefix(e.target.value.toUpperCase())}
                placeholder="DEV"
                className="h-8 font-mono"
                maxLength={8}
              />
            </Field>
            <Field label="Format">
              <select
                value={quoteFormat}
                onChange={(e) => setQuoteFormat(e.target.value as NumberFormat)}
                className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                {FORMAT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </Field>
          </div>
          <p className="text-xs text-muted-foreground">
            Aperçu : <span className="font-mono font-semibold">{buildNumberPreview(quoteFormat, quotePrefix || "DEV")}</span>
          </p>
        </div>

        <div className="border-t border-border/40 pt-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Factures</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Préfixe">
              <Input
                name="invoicePrefix"
                value={invoicePrefix}
                onChange={(e) => setInvoicePrefix(e.target.value.toUpperCase())}
                placeholder="FAC"
                className="h-8 font-mono"
                maxLength={8}
              />
            </Field>
            <Field label="Format">
              <select
                value={invoiceFormat}
                onChange={(e) => setInvoiceFormat(e.target.value as NumberFormat)}
                className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                {FORMAT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </Field>
          </div>
          <p className="text-xs text-muted-foreground">
            Aperçu : <span className="font-mono font-semibold">{buildNumberPreview(invoiceFormat, invoicePrefix || "FAC")}</span>
          </p>
        </div>
      </Section>

      {/* PDF & Documents */}
      <Section icon={<Palette className="h-4 w-4" />} title="PDF & Documents" description="Personnalisez l'apparence de vos devis et factures">

        {/* Logo */}
        <Field label="Logo">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoUrl} alt="Logo" className="h-12 w-auto object-contain rounded border border-border bg-white p-1" />
                <button
                  type="button"
                  onClick={() => setLogoUrl(null)}
                  className="absolute -top-1.5 -right-1.5 rounded-full bg-destructive text-destructive-foreground p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <div className="h-12 w-24 rounded border border-dashed border-border bg-muted/30 flex items-center justify-center text-xs text-muted-foreground">
                Aucun logo
              </div>
            )}
            <div>
              <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={logoUploading}
                onClick={() => logoInputRef.current?.click()}
              >
                {logoUploading ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Envoi…</>
                ) : (
                  <><Upload className="h-3.5 w-3.5 mr-1.5" />Changer le logo</>
                )}
              </Button>
              <p className="text-xs text-muted-foreground mt-1">PNG, SVG ou JPG — max 2 Mo</p>
            </div>
          </div>
        </Field>

        {/* Couleur d'accentuation */}
        <Field label="Couleur d'accentuation">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Presets */}
              {ACCENT_PRESETS.map((p) => (
                <button
                  key={p.color}
                  type="button"
                  title={p.label}
                  onClick={() => setAccentColor(p.color)}
                  className="h-7 w-7 rounded-full border-2 transition-all"
                  style={{
                    backgroundColor: p.color,
                    borderColor: accentColor === p.color ? p.color : "transparent",
                    boxShadow: accentColor === p.color ? `0 0 0 2px white, 0 0 0 4px ${p.color}` : "none",
                  }}
                />
              ))}

              {/* Séparateur */}
              {customColors.length > 0 && (
                <div className="w-px h-5 bg-border mx-0.5 shrink-0" />
              )}

              {/* Couleurs personnalisées */}
              {customColors.map((color, i) => (
                <div key={i} className="relative group shrink-0">
                  <button
                    type="button"
                    title={color}
                    onClick={() => setAccentColor(color)}
                    className="h-7 w-7 rounded-full border-2 transition-all block"
                    style={{
                      backgroundColor: color,
                      borderColor: accentColor === color ? color : "transparent",
                      boxShadow: accentColor === color ? `0 0 0 2px white, 0 0 0 4px ${color}` : "none",
                    }}
                  />
                  {/* Crayon d'édition au hover — label clique sur l'input caché */}
                  <label
                    title="Modifier"
                    className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Pencil className="h-3 w-3 text-white pointer-events-none" />
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => editCustomColor(i, e.target.value)}
                      className="sr-only"
                    />
                  </label>
                  {/* Croix suppression — coin haut-droit */}
                  <button
                    type="button"
                    title="Supprimer"
                    onClick={(e) => { e.stopPropagation(); removeCustomColor(i) }}
                    className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-destructive text-destructive-foreground hidden group-hover:flex items-center justify-center z-10"
                  >
                    <X className="h-2 w-2" />
                  </button>
                </div>
              ))}

              {/* Bouton ajouter une couleur */}
              <label
                title="Ajouter une couleur"
                className="h-7 w-7 rounded-full border-2 border-dashed border-border flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors cursor-pointer shrink-0"
                onClick={handleAddColorClose}
              >
                <Plus className="h-3.5 w-3.5 pointer-events-none" />
                <input
                  type="color"
                  defaultValue="#6366f1"
                  onChange={(e) => handleAddColorChange(e.target.value)}
                  className="sr-only"
                />
              </label>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Aperçu :</span>
              <span className="text-sm font-bold" style={{ color: accentColor }}>DEVIS · FAC-2026-001</span>
            </div>
          </div>
        </Field>

      </Section>

      {/* Conditions générales */}
      <Section
        icon={<ScrollText className="h-4 w-4" />}
        title="Conditions générales"
        description="Modèles réutilisables pré-remplis à la création d'un devis. L'étoile définit le modèle par défaut."
      >
        <ConditionsManager userId={userId} templates={conditionsTemplates} />
      </Section>

        </div>{/* fin colonne droite */}
      </div>{/* fin grid */}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={status === "saving"} className="min-w-40">
          {status === "saving" ? (
            <><Loader2 className="h-4 w-4 animate-spin mr-2" />Enregistrement…</>
          ) : "Enregistrer les modifications"}
        </Button>
        {status === "saved" && (
          <span className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
            <CheckCircle2 className="h-4 w-4" />
            Modifications enregistrées
          </span>
        )}
        {status === "error" && (
          <span className="text-sm text-red-500">Une erreur est survenue, réessayez.</span>
        )}
      </div>
    </form>
  )
}

function Section({ icon, title, description, children }: {
  icon: React.ReactNode
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
      <div>
        <div className="flex items-center gap-2 text-foreground">
          <span className="text-muted-foreground">{icon}</span>
          <h2 className="font-semibold text-sm">{title}</h2>
        </div>
        {description && <p className="text-xs text-muted-foreground mt-1 ml-6">{description}</p>}
      </div>
      {children}
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground font-medium">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
