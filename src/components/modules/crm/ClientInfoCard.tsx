"use client"

import { useState, useTransition, useEffect } from "react"
import {
  Pencil, Check, X, Mail, Phone, Building2, Tag,
  MessageSquare, Loader2, MapPin, Hash,
} from "lucide-react"
import { LinkedinIcon } from "@/components/ui/linkedin-icon"
import { updateClientAll, updateProspectStage } from "@/actions/crm"
import { cn } from "@/lib/utils"
import { CompanyCombobox } from "./CompanyCombobox"
import { STAGE_CONFIG, type ProspectStage } from "./ProspectsView"

const SOURCE_LABELS: Record<string, string> = {
  WORD_OF_MOUTH: "Bouche à oreille",
  LINKEDIN: "LinkedIn",
  WEBSITE: "Site web",
  INBOUND: "Entrant",
  OTHER: "Autre",
}

const TYPE_OPTIONS = [
  { value: "PROSPECT",  label: "Prospect" },
  { value: "CLIENT",    label: "Client" },
  { value: "PERSONAL",  label: "Perso" },
  { value: "RECRUITER", label: "Recruteur" },
  { value: "INACTIVE",  label: "Inactif" },
]

const TYPE_CLS: Record<string, string> = {
  PROSPECT:    "bg-amber-500/15 text-amber-600 border-amber-500/20",
  CLIENT:      "bg-emerald-500/15 text-emerald-600 border-emerald-500/20",
  PERSONAL:    "bg-violet-500/15 text-violet-600 border-violet-500/20",
  RECRUITER:   "bg-sky-500/15 text-sky-600 border-sky-500/20",
  INACTIVE:    "bg-muted text-muted-foreground border-border",
  TO_COMPLETE: "bg-rose-500/15 text-rose-600 border-rose-500/20",
}

const TEMP_CONFIG: Record<string, { label: string; emoji: string; cls: string }> = {
  COLD: { label: "Neutre", emoji: "○", cls: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  WARM: { label: "Tiède",  emoji: "🌤", cls: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  HOT:  { label: "Chaud",  emoji: "🔥", cls: "bg-red-500/10 text-red-600 border-red-500/20" },
}

type ClientData = {
  id: string
  name: string
  firstName: string | null
  lastName: string | null
  label: string | null
  company: string | null
  companyId: string | null
  email: string | null
  phone: string | null
  linkedinUrl: string | null
  source: string
  notes: string | null
  type: string
  temperature: string
  prospectStage: string
  address: string | null
  postalCode: string | null
  city: string | null
  country: string | null
  siret: string | null
}

export function ClientInfoCard({ client, isOwner = true }: { client: ClientData; isOwner?: boolean }) {
  const [editing, setEditing] = useState(false)
  const [isPending, startTransition] = useTransition()

  const [firstName, setFirstName] = useState(client.firstName ?? "")
  const [lastName, setLastName] = useState(client.lastName ?? "")
  const [label, setLabel] = useState(client.label ?? "")
  const [company, setCompany] = useState<{ id: string | null; name: string }>({
    id: client.companyId,
    name: client.company ?? "",
  })
  const [email, setEmail] = useState(client.email ?? "")
  const [phone, setPhone] = useState(client.phone ?? "")
  const [linkedinUrl, setLinkedinUrl] = useState(client.linkedinUrl ?? "")
  const [source, setSource] = useState(client.source)
  const [notes, setNotes] = useState(client.notes ?? "")
  const [type, setType] = useState(client.type)
  const [temperature, setTemperature] = useState(client.temperature)
  const [address, setAddress] = useState(client.address ?? "")
  const [postalCode, setPostalCode] = useState(client.postalCode ?? "")
  const [city, setCity] = useState(client.city ?? "")
  const [country, setCountry] = useState(client.country ?? "")
  const [siret, setSiret] = useState(client.siret ?? "")
  const [prospectStage, setProspectStage] = useState(client.prospectStage ?? "IDENTIFIED")

  useEffect(() => {
    if (!editing) return
    /* eslint-disable react-hooks/set-state-in-effect */
    setFirstName(client.firstName ?? "")
    setLastName(client.lastName ?? "")
    setLabel(client.label ?? "")
    setCompany({ id: client.companyId, name: client.company ?? "" })
    setEmail(client.email ?? "")
    setPhone(client.phone ?? "")
    setLinkedinUrl(client.linkedinUrl ?? "")
    setSource(client.source)
    setNotes(client.notes ?? "")
    setType(client.type)
    setTemperature(client.temperature)
    setProspectStage(client.prospectStage ?? "IDENTIFIED")
    setAddress(client.address ?? "")
    setPostalCode(client.postalCode ?? "")
    setCity(client.city ?? "")
    setCountry(client.country ?? "")
    setSiret(client.siret ?? "")
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [editing]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleSave() {
    startTransition(async () => {
      const saves: Promise<unknown>[] = [
        updateClientAll(client.id, {
          firstName: firstName.trim() || null,
          lastName: lastName.trim() || null,
          label: label.trim() || null,
          companyId: company.id,
          companyName: company.name.trim() || null,
          email: email.trim() || null,
          phone: phone.trim() || null,
          linkedinUrl: linkedinUrl.trim() || null,
          source,
          notes: notes.trim() || null,
          type,
          temperature,
          address: address.trim() || null,
          postalCode: postalCode.trim() || null,
          city: city.trim() || null,
          country: country.trim() || null,
          siret: siret.trim() || null,
        }),
      ]
      if (type === "PROSPECT" && prospectStage !== client.prospectStage) {
        saves.push(updateProspectStage(client.id, prospectStage as ProspectStage))
      }
      await Promise.all(saves)
      setEditing(false)
    })
  }

  const temp = TEMP_CONFIG[client.temperature] ?? TEMP_CONFIG.COLD
  const typeLabel = TYPE_OPTIONS.find((t) => t.value === client.type)?.label ?? client.type

  return (
    <div className={cn(
      "rounded-xl border border-border/50 bg-card p-5 space-y-4 transition-opacity",
      isPending && "opacity-60 pointer-events-none"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-sm">Informations</h2>
        <div className="flex items-center gap-1">
          {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          {isOwner && (editing ? (
            <>
              <button
                onClick={() => setEditing(false)}
                disabled={isPending}
                className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                title="Annuler"
              >
                <X className="h-4 w-4" />
              </button>
              <button
                onClick={handleSave}
                disabled={isPending}
                className="p-1 rounded text-emerald-600 hover:text-emerald-500 transition-colors"
                title="Enregistrer"
              >
                <Check className="h-4 w-4" />
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
              title="Modifier"
            >
              <Pencil className="h-4 w-4" />
            </button>
          ))}
        </div>
      </div>

      {editing ? (
        /* ── Mode édition ── */
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Libellé du contact</label>
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Optionnel — ex. « Compta Acme »" className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Prénom</label>
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Jean" className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Nom</label>
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Dupont" className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Société</label>
            <CompanyCombobox value={company} onChange={setCompany} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Téléphone</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">LinkedIn</label>
            <input
              value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)}
              placeholder="https://linkedin.com/in/…"
              className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Type</label>
              <select value={type} onChange={(e) => setType(e.target.value)} className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Température</label>
              <select value={temperature} onChange={(e) => setTemperature(e.target.value)} className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                <option value="COLD">○ Neutre</option>
                <option value="WARM">🌤 Tiède</option>
                <option value="HOT">🔥 Chaud</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Source</label>
              <select value={source} onChange={(e) => setSource(e.target.value)} className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                {Object.entries(SOURCE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>

          {/* Étape prospect — visible uniquement si le type actuel est PROSPECT */}
          {type === "PROSPECT" && (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Étape prospect</label>
              <select value={prospectStage} onChange={(e) => setProspectStage(e.target.value)} className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                <optgroup label="Pipeline">
                  {(["IDENTIFIED","CONTACTED","NO_RESPONSE","REPLIED","MEETING","PROPOSAL_SENT","NEGOTIATION"] as ProspectStage[]).map((s) => (
                    <option key={s} value={s}>{STAGE_CONFIG[s].label}</option>
                  ))}
                </optgroup>
                <optgroup label="Résultat">
                  {(["WON","LOST","ON_HOLD"] as ProspectStage[]).map((s) => (
                    <option key={s} value={s}>{STAGE_CONFIG[s].label}</option>
                  ))}
                </optgroup>
              </select>
            </div>
          )}

          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70 pt-1">Adresse du contact <span className="font-normal normal-case">(optionnelle)</span></p>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Adresse</label>
            <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="12 rue de la Paix" className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Code postal</label>
              <input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="75001" className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Ville</label>
              <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Paris" className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Pays</label>
              <input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="France" className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">SIRET</label>
            <input value={siret} onChange={(e) => setSiret(e.target.value)} placeholder="123 456 789 00012" className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Notes internes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Notes privées..." className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring resize-none" />
          </div>
        </div>
      ) : (
        /* ── Mode lecture ── */
        <div className="space-y-3">
          {/* Type + Température + Étape prospect */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-medium", TYPE_CLS[client.type] ?? TYPE_CLS.INACTIVE)}>
              {typeLabel}
            </span>
            {client.type === "PROSPECT" && (() => {
              const stageCfg = STAGE_CONFIG[client.prospectStage as ProspectStage]
              return stageCfg ? (
                <span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-medium", stageCfg.cls)}>
                  {stageCfg.label}
                </span>
              ) : null
            })()}
            <span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-medium", temp.cls)}>
              {temp.emoji} {temp.label}
            </span>
          </div>

          {/* Coordonnées */}
          <div className="space-y-2">
            {client.email && (
              <div className="flex items-center gap-2.5 text-sm">
                <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <a href={`mailto:${client.email}`} className="hover:text-primary transition-colors truncate">{client.email}</a>
              </div>
            )}
            {client.phone && (
              <div className="flex items-center gap-2.5 text-sm">
                <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <a href={`tel:${client.phone}`} className="hover:text-primary transition-colors">{client.phone}</a>
              </div>
            )}
            {client.company && (
              <div className="flex items-center gap-2.5 text-sm">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">{client.company}</span>
              </div>
            )}
            <div className="flex items-center gap-2.5 text-sm">
              <Tag className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">{SOURCE_LABELS[client.source] ?? client.source}</span>
            </div>
            {(client.address || client.city || client.postalCode) && (
              <div className="flex items-start gap-2.5 text-sm">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <span className="text-muted-foreground leading-relaxed">
                  {[client.address, [client.postalCode, client.city].filter(Boolean).join(" "), client.country].filter(Boolean).join(", ")}
                </span>
              </div>
            )}
            {client.siret && (
              <div className="flex items-center gap-2.5 text-sm">
                <Hash className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground font-mono text-xs">{client.siret}</span>
              </div>
            )}
            {client.linkedinUrl && (
              <div className="flex items-center gap-2.5 text-sm">
                <LinkedinIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <a href={client.linkedinUrl} target="_blank" rel="noopener noreferrer"
                  className="text-sky-600 hover:underline text-xs truncate max-w-[200px]">
                  LinkedIn
                </a>
              </div>
            )}
          </div>

          {/* Notes */}
          {client.notes && (
            <div className="flex items-start gap-2.5 pt-1 border-t border-border/30">
              <MessageSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{client.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
