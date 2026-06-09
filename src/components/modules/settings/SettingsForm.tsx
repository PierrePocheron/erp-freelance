"use client"

import { useState } from "react"
import { saveProfile, type ProfileData } from "@/actions/settings"
import { type NumberFormat, FORMAT_OPTIONS, buildNumberPreview } from "@/lib/number-format"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { User, FileText, CheckCircle2, Loader2, ScrollText } from "lucide-react"
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

export function SettingsForm({ userId, profile, userName, userEmail, conditionsTemplates }: Props) {
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [quotePrefix, setQuotePrefix] = useState(profile?.quotePrefix ?? "DEV")
  const [invoicePrefix, setInvoicePrefix] = useState(profile?.invoicePrefix ?? "FAC")
  const [quoteFormat, setQuoteFormat] = useState<NumberFormat>((profile?.quoteNumberFormat as NumberFormat) ?? "PREFIX-YYYY-NNN")
  const [invoiceFormat, setInvoiceFormat] = useState<NumberFormat>((profile?.invoiceNumberFormat as NumberFormat) ?? "PREFIX-YYYY-NNN")

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
