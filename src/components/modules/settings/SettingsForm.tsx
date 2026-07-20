"use client"

import { useEffect, useMemo, useState } from "react"
import { saveProfile, type ProfileData } from "@/actions/settings"
import { type NumberFormat, FORMAT_OPTIONS, buildNumberPreview } from "@/lib/number-format"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { User, FileText, CheckCircle2, Loader2, ScrollText, Palette, Plus, TriangleAlert, X } from "lucide-react"
import { ConditionsManager } from "./ConditionsManager"

// Couleurs proposées pour le point du logo (vert « Pedro Dev » en tête).
const PDF_ACCENT_PRESETS = ["#6BCB3D", "#6366f1", "#0ea5e9", "#f59e0b", "#ef4444", "#ec4899", "#111111"]
// Fonds de page : crème « Pedro Dev », blanc, gris très clair.
const PDF_BACKGROUND_PRESETS = ["#FAF6EE", "#FFFFFF", "#F5F5F4"]

const sameColor = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()
const inPalette = (list: string[], c: string) => list.some((x) => sameColor(x, c))
const isHexColor = (c: unknown): c is string => typeof c === "string" && /^#[0-9a-fA-F]{6}$/.test(c)

// Palettes personnalisées, stockées en JSON dans UserProfile.customAccentColors :
// { accent: string[], background: string[] } — tolère l'ancien format tableau nu.
function parseCustomPalettes(json: string | null | undefined): { accent: string[]; background: string[] } {
  if (!json) return { accent: [], background: [] }
  try {
    const parsed: unknown = JSON.parse(json)
    if (Array.isArray(parsed)) return { accent: parsed.filter(isHexColor), background: [] }
    const obj = parsed as { accent?: unknown; background?: unknown }
    return {
      accent: Array.isArray(obj.accent) ? obj.accent.filter(isHexColor) : [],
      background: Array.isArray(obj.background) ? obj.background.filter(isHexColor) : [],
    }
  } catch {
    return { accent: [], background: [] }
  }
}

/** Ajoute la couleur sélectionnée à la palette si elle n'est ni un preset ni déjà connue. */
function paletteWithSelection(palette: string[], value: string, presets: string[]): string[] {
  return inPalette(presets, value) || inPalette(palette, value) ? palette : [...palette, value]
}

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
  const [pdfBankName, setPdfBankName] = useState(profile?.pdfBankName ?? "")

  // Palettes de couleurs personnalisées (persistées) : une couleur choisie via
  // le picker « + » y est ajoutée à l'enregistrement et reste réutilisable.
  const initialPalettes = parseCustomPalettes(profile?.customAccentColors)
  const [customAccent, setCustomAccent] = useState<string[]>(initialPalettes.accent)
  const [customBackground, setCustomBackground] = useState<string[]>(initialPalettes.background)

  // ── Détection des modifications non enregistrées ──────────────────────────
  const makeSnapshot = () => JSON.stringify({
    quotePrefix, invoicePrefix, quoteFormat, invoiceFormat,
    pdfLogoText, pdfLogoSubtext, pdfAccentColor, pdfBackgroundColor,
    pdfBankName, customAccent, customBackground,
  })
  const [savedSnapshot, setSavedSnapshot] = useState(makeSnapshot)
  const currentSnapshot = makeSnapshot()
  const dirty = useMemo(() => currentSnapshot !== savedSnapshot, [currentSnapshot, savedSnapshot])

  // Garde-fou navigateur : fermeture d'onglet / rechargement / navigation dure
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty])

  // Garde-fou navigation interne : beforeunload ne couvre pas le routing client
  // Next (clic sidebar…) → on intercepte les clics de liens en phase capture et
  // on demande confirmation tant que des modifications ne sont pas enregistrées.
  useEffect(() => {
    if (!dirty) return
    const confirmLeave = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest?.("a[href]") as HTMLAnchorElement | null
      if (!anchor) return
      const href = anchor.getAttribute("href")
      if (!href || href.startsWith("#") || anchor.target === "_blank" || e.metaKey || e.ctrlKey) return
      if (!window.confirm("Modifications non enregistrées — quitter sans sauvegarder ?")) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    document.addEventListener("click", confirmLeave, true)
    return () => document.removeEventListener("click", confirmLeave, true)
  }, [dirty])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setStatus("saving")
    // Une couleur personnalisée sélectionnée rejoint définitivement sa palette
    const nextAccentPalette = paletteWithSelection(customAccent, pdfAccentColor, PDF_ACCENT_PRESETS)
    const nextBackgroundPalette = paletteWithSelection(customBackground, pdfBackgroundColor, PDF_BACKGROUND_PRESETS)
    try {
      await saveProfile(userId, {
        quotePrefix: quotePrefix || "DEV",
        invoicePrefix: invoicePrefix || "FAC",
        quoteNumberFormat: quoteFormat,
        invoiceNumberFormat: invoiceFormat,
        pdfLogoText: pdfLogoText.trim(),
        pdfLogoSubtext: pdfLogoSubtext.trim(),
        pdfAccentColor,
        pdfBackgroundColor,
        customAccentColors: JSON.stringify({ accent: nextAccentPalette, background: nextBackgroundPalette }),
        pdfBankName: pdfBankName.trim() || null,
      })
      setCustomAccent(nextAccentPalette)
      setCustomBackground(nextBackgroundPalette)
      setSavedSnapshot(JSON.stringify({
        quotePrefix, invoicePrefix, quoteFormat, invoiceFormat,
        pdfLogoText, pdfLogoSubtext, pdfAccentColor, pdfBackgroundColor,
        pdfBankName, customAccent: nextAccentPalette, customBackground: nextBackgroundPalette,
      }))
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

        <Field
          label="Couleur du point et des accents"
          hint="Une couleur choisie via « + » rejoint votre palette à l'enregistrement"
        >
          <ColorSwatches
            presets={PDF_ACCENT_PRESETS}
            custom={customAccent}
            value={pdfAccentColor}
            variant="accent"
            onSelect={setPdfAccentColor}
            onRemove={(c) => setCustomAccent((list) => list.filter((x) => !sameColor(x, c)))}
          />
        </Field>

        <Field
          label="Fond de page"
          hint="Une couleur choisie via « + » rejoint votre palette à l'enregistrement"
        >
          <ColorSwatches
            presets={PDF_BACKGROUND_PRESETS}
            custom={customBackground}
            value={pdfBackgroundColor}
            variant="background"
            onSelect={setPdfBackgroundColor}
            onRemove={(c) => setCustomBackground((list) => list.filter((x) => !sameColor(x, c)))}
          />
        </Field>

        <Field
          label="Banque (bloc règlement)"
          hint="Utilisée pour les documents sans société émettrice — sinon c'est la banque de la société qui s'affiche"
        >
          <Input
            name="pdfBankName"
            value={pdfBankName}
            onChange={(e) => setPdfBankName(e.target.value)}
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

      {/* Barre flottante : modifications non enregistrées */}
      {dirty && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-xl border border-amber-500/40 bg-background/95 backdrop-blur px-4 py-2.5 shadow-lg">
          <TriangleAlert className="h-4 w-4 text-amber-500 shrink-0" />
          <span className="text-sm">
            Modifications non enregistrées — elles seront perdues si vous quittez la page.
          </span>
          <Button type="submit" size="sm" disabled={status === "saving"}>
            {status === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enregistrer"}
          </Button>
        </div>
      )}
    </form>
  )
}

/**
 * Rangée de pastilles couleur : presets + palette personnalisée persistée +
 * couleur en cours de choix (pas encore enregistrée). Les couleurs de la
 * palette se retirent au survol (sauf celle actuellement sélectionnée).
 */
function ColorSwatches({
  presets,
  custom,
  value,
  variant,
  onSelect,
  onRemove,
}: {
  presets: string[]
  custom: string[]
  value: string
  variant: "accent" | "background"
  onSelect: (c: string) => void
  onRemove: (c: string) => void
}) {
  const borderCls = variant === "accent" ? "border-2" : "border"
  const swatchStyle = (c: string, selected: boolean) =>
    variant === "accent"
      ? {
          backgroundColor: c,
          borderColor: selected ? c : "transparent",
          boxShadow: selected ? `0 0 0 2px white, 0 0 0 4px ${c}` : "none",
        }
      : {
          backgroundColor: c,
          borderColor: "var(--border)",
          boxShadow: selected ? "0 0 0 2px white, 0 0 0 4px #94a3b8" : "none",
        }
  // Couleur choisie via le picker mais encore inconnue : pastille "en attente"
  const pending = !inPalette(presets, value) && !inPalette(custom, value)

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {presets.map((c) => (
        <button
          key={c}
          type="button"
          title={c}
          onClick={() => onSelect(c)}
          className={`h-7 w-7 rounded-full ${borderCls} transition-all`}
          style={swatchStyle(c, sameColor(value, c))}
        />
      ))}
      {custom.map((c) => {
        const selected = sameColor(value, c)
        return (
          <span key={c} className="relative group inline-flex">
            <button
              type="button"
              title={c}
              onClick={() => onSelect(c)}
              className={`h-7 w-7 rounded-full ${borderCls} transition-all`}
              style={swatchStyle(c, selected)}
            />
            {!selected && (
              <button
                type="button"
                title="Retirer cette couleur de la palette"
                onClick={() => onRemove(c)}
                className="absolute -top-1.5 -right-1.5 hidden group-hover:flex h-4 w-4 items-center justify-center rounded-full bg-foreground text-background"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            )}
          </span>
        )
      })}
      {pending && (
        <button
          type="button"
          title={`${value} — sera ajoutée à votre palette à l'enregistrement`}
          onClick={() => onSelect(value)}
          className={`h-7 w-7 rounded-full ${borderCls} transition-all`}
          style={swatchStyle(value, true)}
        />
      )}
      <label
        title="Couleur personnalisée"
        className="h-7 w-7 rounded-full border-2 border-dashed border-border flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors cursor-pointer shrink-0"
      >
        <Plus className="h-3.5 w-3.5 pointer-events-none" />
        <input type="color" value={value} onChange={(e) => onSelect(e.target.value)} className="sr-only" />
      </label>
    </div>
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
