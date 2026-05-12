"use client"

import { useState, useRef } from "react"
import { saveProfile, type ProfileData } from "@/actions/settings"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { User, Building2, CreditCard, FileText, CheckCircle2, Loader2, Palette, Upload, X } from "lucide-react"

type Props = {
  userId: string
  profile: ProfileData | null
  userName: string | null
  userEmail: string | null
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

export function SettingsForm({ userId, profile, userName, userEmail }: Props) {
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [accentColor, setAccentColor] = useState(profile?.pdfAccentColor ?? "#6366f1")
  const [logoUrl, setLogoUrl] = useState<string | null>(profile?.logoUrl ?? null)
  const [logoUploading, setLogoUploading] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("folder", "logos")
      const res = await fetch("/api/upload", { method: "POST", body: fd })
      const json = await res.json()
      if (json.url) setLogoUrl(json.url)
    } finally {
      setLogoUploading(false)
    }
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
        pdfAccentColor: accentColor,
        defaultConditions: (fd.get("defaultConditions") as string) || null,
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

      {/* Numérotation */}
      <Section icon={<FileText className="h-4 w-4" />} title="Numérotation" description="Préfixes utilisés pour générer les numéros de documents (ex: DEV-2026-001)">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Préfixe devis">
            <Input name="quotePrefix" defaultValue={profile?.quotePrefix ?? "DEV"} placeholder="DEV" className="h-8 font-mono" maxLength={6} />
          </Field>
          <Field label="Préfixe facture">
            <Input name="invoicePrefix" defaultValue={profile?.invoicePrefix ?? "FAC"} placeholder="FAC" className="h-8 font-mono" maxLength={6} />
          </Field>
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
              <div className="flex items-center gap-1.5 ml-2">
                <label className="text-xs text-muted-foreground">Personnalisée</label>
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="h-7 w-7 rounded border border-border cursor-pointer bg-transparent p-0.5"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Aperçu :</span>
              <span className="text-sm font-bold" style={{ color: accentColor }}>DEVIS · FAC-2026-001</span>
            </div>
          </div>
        </Field>

        {/* Conditions par défaut */}
        <Field label="Conditions générales par défaut" hint="Pré-remplies à la création d'un nouveau devis">
          <textarea
            name="defaultConditions"
            rows={4}
            defaultValue={profile?.defaultConditions ?? ""}
            placeholder="Paiement à 30 jours. En cas de retard, une pénalité de 1,5% par mois sera appliquée..."
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
          />
        </Field>
      </Section>

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
