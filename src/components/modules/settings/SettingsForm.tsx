"use client"

import { useState } from "react"
import { saveProfile, type ProfileData } from "@/actions/settings"
import { type NumberFormat, FORMAT_OPTIONS, buildNumberPreview } from "@/lib/number-format"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { User, FileText, CheckCircle2, Loader2, ScrollText, Palette, Plus } from "lucide-react"
import { ConditionsManager } from "./ConditionsManager"

// Couleurs proposées pour le point du logo (vert « Pedro Dev » en tête).
const PDF_ACCENT_PRESETS = ["#6BCB3D", "#6366f1", "#0ea5e9", "#f59e0b", "#ef4444", "#ec4899", "#111111"]
// Fonds de page : crème « Pedro Dev », blanc, gris très clair.
const PDF_BACKGROUND_PRESETS = ["#FAF6EE", "#FFFFFF", "#F5F5F4"]

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

export function SettingsForm({ userId, profile, userName, userEmail, conditionsTemplates }: Props) {
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [quotePrefix, setQuotePrefix] = useState(profile?.quotePrefix ?? "DEV")
  const [invoicePrefix, setInvoicePrefix] = useState(profile?.invoicePrefix ?? "FAC")
  const [quoteFormat, setQuoteFormat] = useState<NumberFormat>((profile?.quoteNumberFormat as NumberFormat) ?? "PREFIX-YYYY-NNN")
  const [invoiceFormat, setInvoiceFormat] = useState<NumberFormat>((profile?.invoiceNumberFormat as NumberFormat) ?? "PREFIX-YYYY-NNN")
  // Branding des PDF (template « Pedro »)
  const [pdfLogoText, setPdfLogoText] = useState(profile?.pdfLogoText ?? "")
  const [pdfLogoSubtext, setPdfLogoSubtext] = useState(profile?.pdfLogoSubtext ?? "")
  // Défauts dynamiques (miroir client de emitter-resolve.ts) : initiales de
  // l'utilisateur pour le logo, raison sociale/nom pour le sous-titre.
  const nameWords = (userName ?? "").trim().split(/\s+/).filter(Boolean)
  const defaultInitials = nameWords.length >= 2
    ? (nameWords[0][0] + nameWords[1][0]).toUpperCase()
    : (nameWords[0]?.slice(0, 2) ?? userEmail?.[0] ?? "•").toUpperCase()
  const defaultSubtext = (profile?.companyName ?? userName ?? "").toUpperCase()
  const [pdfAccentColor, setPdfAccentColor] = useState(profile?.pdfAccentColor ?? "#6366f1")
  const [pdfBackgroundColor, setPdfBackgroundColor] = useState(profile?.pdfBackgroundColor ?? "#FAF6EE")

  // Une couleur personnalisée (choisie via le picker « + ») n'est dans aucun
  // preset : on l'affiche comme pastille supplémentaire, sinon elle semble ne
  // jamais s'ajouter alors qu'elle est bien dans l'état et sauvegardée.
  const sameColor = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()
  const accentSwatches = PDF_ACCENT_PRESETS.some((c) => sameColor(c, pdfAccentColor))
    ? PDF_ACCENT_PRESETS
    : [...PDF_ACCENT_PRESETS, pdfAccentColor]
  const backgroundSwatches = PDF_BACKGROUND_PRESETS.some((c) => sameColor(c, pdfBackgroundColor))
    ? PDF_BACKGROUND_PRESETS
    : [...PDF_BACKGROUND_PRESETS, pdfBackgroundColor]

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setStatus("saving")
    const fd = new FormData(e.currentTarget)
    try {
      await saveProfile(userId, {
        quotePrefix: (fd.get("quotePrefix") as string) || "DEV",
        invoicePrefix: (fd.get("invoicePrefix") as string) || "FAC",
        quoteNumberFormat: quoteFormat,
        invoiceNumberFormat: invoiceFormat,
        pdfLogoText: pdfLogoText.trim(),
        pdfLogoSubtext: pdfLogoSubtext.trim(),
        pdfAccentColor,
        pdfBackgroundColor,
        pdfBankName: ((fd.get("pdfBankName") as string) || "").trim() || null,
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

      {/* Compte */}
      <Section icon={<User className="h-4 w-4" />} title="Compte" description="Identité issue de votre compte Google">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Nom complet" hint="Modifiable via votre compte Google">
            <Input value={userName ?? ""} disabled className="h-8 bg-muted/40" readOnly />
          </Field>
          <Field label="Email">
            <Input value={userEmail ?? ""} disabled className="h-8 bg-muted/40" readOnly />
          </Field>
        </div>
      </Section>

      {/* Numérotation */}
      <Section icon={<FileText className="h-4 w-4" />} title="Numérotation" description="Format et préfixes des numéros de documents — partagés par toutes vos sociétés">
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

        </div>{/* fin colonne gauche */}

        {/* Colonne droite */}
        <div className="space-y-6">

      {/* Conditions générales */}
      <Section
        icon={<ScrollText className="h-4 w-4" />}
        title="Conditions générales"
        description="Modèles réutilisables pré-remplis à la création d'un devis. L'étoile définit le modèle par défaut."
      >
        <ConditionsManager userId={userId} templates={conditionsTemplates} />
      </Section>

      {/* Branding des PDF */}
      <Section
        icon={<Palette className="h-4 w-4" />}
        title="Documents PDF"
        description="Apparence des devis et factures générés : logo texte, couleurs et banque du bloc règlement."
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Texte du logo" hint="Vide = vos initiales · le point final prend la couleur d'accent">
            <Input
              value={pdfLogoText}
              onChange={(e) => setPdfLogoText(e.target.value)}
              placeholder={defaultInitials}
              className="h-8"
              maxLength={8}
            />
          </Field>
          <Field label="Sous-titre du logo">
            <Input
              value={pdfLogoSubtext}
              onChange={(e) => setPdfLogoSubtext(e.target.value)}
              placeholder="PEDRO DEV"
              className="h-8"
              maxLength={32}
            />
          </Field>
        </div>

        <Field label="Couleur du point et des accents">
          <div className="flex items-center gap-2 flex-wrap">
            {accentSwatches.map((c) => (
              <button
                key={c}
                type="button"
                title={c}
                onClick={() => setPdfAccentColor(c)}
                className="h-7 w-7 rounded-full border-2 transition-all"
                style={{
                  backgroundColor: c,
                  borderColor: sameColor(pdfAccentColor, c) ? c : "transparent",
                  boxShadow: sameColor(pdfAccentColor, c) ? `0 0 0 2px white, 0 0 0 4px ${c}` : "none",
                }}
              />
            ))}
            <label
              title="Couleur personnalisée"
              className="h-7 w-7 rounded-full border-2 border-dashed border-border flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors cursor-pointer shrink-0"
            >
              <Plus className="h-3.5 w-3.5 pointer-events-none" />
              <input
                type="color"
                value={pdfAccentColor}
                onChange={(e) => setPdfAccentColor(e.target.value)}
                className="sr-only"
              />
            </label>
          </div>
        </Field>

        <Field label="Fond de page">
          <div className="flex items-center gap-2 flex-wrap">
            {backgroundSwatches.map((c) => (
              <button
                key={c}
                type="button"
                title={c}
                onClick={() => setPdfBackgroundColor(c)}
                className="h-7 w-7 rounded-full border transition-all"
                style={{
                  backgroundColor: c,
                  borderColor: "var(--border)",
                  boxShadow: sameColor(pdfBackgroundColor, c) ? "0 0 0 2px white, 0 0 0 4px #94a3b8" : "none",
                }}
              />
            ))}
            <label
              title="Couleur personnalisée"
              className="h-7 w-7 rounded-full border-2 border-dashed border-border flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors cursor-pointer shrink-0"
            >
              <Plus className="h-3.5 w-3.5 pointer-events-none" />
              <input
                type="color"
                value={pdfBackgroundColor}
                onChange={(e) => setPdfBackgroundColor(e.target.value)}
                className="sr-only"
              />
            </label>
          </div>
        </Field>

        <Field
          label="Banque (bloc règlement)"
          hint="Utilisée pour les documents sans société émettrice — sinon c'est la banque de la société qui s'affiche"
        >
          <Input
            name="pdfBankName"
            defaultValue={profile?.pdfBankName ?? ""}
            placeholder="Revolut"
            className="h-8"
          />
        </Field>

        {/* Aperçu de l'en-tête du PDF */}
        <div
          className="rounded-md border border-border/60 p-4"
          style={{ backgroundColor: pdfBackgroundColor }}
        >
          <div
            className="border border-black/80 px-4 py-3 flex items-start justify-between gap-4"
            style={{ color: "#111111", fontFamily: "Poppins, ui-sans-serif, sans-serif" }}
          >
            <div className="min-w-0">
              <p className="text-2xl font-extrabold leading-none tracking-tight truncate">
                {pdfLogoText.trim() || defaultInitials}
                <span style={{ color: pdfAccentColor }}>.</span>
              </p>
              {(pdfLogoSubtext.trim() || defaultSubtext) && (
                <p className="text-[9px] font-semibold uppercase tracking-[0.3em] mt-1 truncate">
                  {pdfLogoSubtext.trim() || defaultSubtext}
                </p>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="text-2xl font-extrabold leading-none">FACTURE</p>
              <p className="text-[10px] font-extrabold mt-1">FACTURE N° : 250701</p>
              <p className="text-[8px] font-semibold uppercase tracking-widest mt-0.5">JUILLET 2025</p>
            </div>
          </div>
        </div>
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
