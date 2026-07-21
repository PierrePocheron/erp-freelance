"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useEffect, useTransition } from "react"
import {
  Mail, Phone, ExternalLink, Building2, Globe,
  MessageSquare, Bell, FolderKanban, FileText, Receipt,
  Phone as PhoneIcon, Mail as MailIcon, Video, Users,
  UserCheck, Archive, AlertCircle, Pencil, MapPin,
} from "lucide-react"
import { ProspectInterestSelect } from "@/components/modules/prospection/ProspectInterestSelect"
import { cn } from "@/lib/utils"
import { updateClientType, addInteraction, addReminder, updateClientAll } from "@/actions/crm"
import { updateProspectStatus } from "@/actions/prospection"
import { STATUS_CONFIG, PIPELINE_STATUSES, OUTCOME_STATUSES, WEBSITE_TYPE_CONFIG } from "@/components/modules/prospection/status-config"
import { isContactIncomplete } from "@/lib/contact"
import type { ProspectStatus, WebsiteType } from "@/generated/prisma/enums"
import { toast } from "sonner"

const typeConfig = {
  TO_COMPLETE: { label: "À compléter", className: "bg-rose-500/15 text-rose-600 border-rose-500/20" },
  PROSPECT: { label: "Prospect", className: "bg-amber-500/15 text-amber-600 border-amber-500/20" },
  CLIENT: { label: "Client", className: "bg-emerald-500/15 text-emerald-600 border-emerald-500/20" },
  PERSONAL: { label: "Perso", className: "bg-violet-500/15 text-violet-600 border-violet-500/20" },
  SELF: { label: "Perso", className: "bg-indigo-500/15 text-indigo-600 border-indigo-500/20" },
  INACTIVE: { label: "Inactif", className: "bg-muted text-muted-foreground border-border" },
}

const channelIcon: Record<string, React.ReactNode> = {
  EMAIL: <MailIcon className="h-3 w-3" />,
  CALL: <PhoneIcon className="h-3 w-3" />,
  MEETING: <Users className="h-3 w-3" />,
  LINKEDIN: <Users className="h-3 w-3" />,
  VIDEO: <Video className="h-3 w-3" />,
  SMS: <MessageSquare className="h-3 w-3" />,
  OTHER: <MessageSquare className="h-3 w-3" />,
}

const projectStatusConfig: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: "Actif", className: "bg-emerald-500/15 text-emerald-600 border-emerald-500/20" },
  PAUSED: { label: "En pause", className: "bg-amber-500/15 text-amber-600 border-amber-500/20" },
  COMPLETED: { label: "Terminé", className: "bg-blue-500/15 text-blue-600 border-blue-500/20" },
  ARCHIVED: { label: "Archivé", className: "bg-muted text-muted-foreground border-border" },
}

const invoiceStatusConfig: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Brouillon", className: "text-muted-foreground" },
  SENT: { label: "Envoyée", className: "text-blue-600" },
  PAID: { label: "Payée", className: "text-emerald-600" },
  LATE: { label: "En retard", className: "text-red-500" },
  CANCELLED: { label: "Annulée", className: "text-muted-foreground" },
}

const quoteStatusConfig: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Brouillon", className: "text-muted-foreground" },
  SENT: { label: "Envoyé", className: "text-blue-600" },
  ACCEPTED: { label: "Accepté", className: "text-emerald-600" },
  REJECTED: { label: "Refusé", className: "text-red-500" },
}

type Interaction = { id: string; date: Date | string; channel: string; summary: string }
type Reminder = { id: string; dueDate: Date | string; note: string | null }
type Project = { id: string; name: string; status: string }
type Invoice = { id: string; number: string; status: string; totalHT: number; depositDeducted: number; createdAt: Date | string }
type Quote = { id: string; number: string; status: string; totalHT: number; createdAt: Date | string }

type ClientPanelData = {
  id: string
  name: string
  firstName: string | null
  lastName: string | null
  company: string | null
  jobTitle?: string | null
  email: string | null
  personalEmail: string | null
  phone: string | null
  phoneType: string | null
  interestLevel: number | null
  address: string | null
  postalCode: string | null
  city: string | null
  type: string
  source: string
  notes: string | null
  prospectStatus: ProspectStatus
  websiteUrl: string | null
  websiteType: string | null
  interactions: Interaction[]
  reminders: Reminder[]
  projects: Project[]
  invoices: Invoice[]
  quotes: Quote[]
  _count: { interactions: number; projects: number; invoices: number; quotes: number }
}

export function ClientPanel({
  client,
  loading,
  userId,
  onRefresh,
}: {
  client: ClientPanelData | null
  loading: boolean
  userId?: string
  onRefresh?: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [, startStageTransition] = useTransition()
  const [, startLogTransition] = useTransition()
  const [, startReminderTransition] = useTransition()
  const router = useRouter()
  const [isSavingQuick, startQuickTransition] = useTransition()
  const [stageDropOpen, setStageDropOpen] = useState(false)
  const [quickPanel, setQuickPanel] = useState<"log" | "reminder" | null>(null)
  const [logChannel, setLogChannel] = useState("EMAIL")
  const [logSummary, setLogSummary] = useState("")
  const [reminderDate, setReminderDate] = useState(() => new Date().toISOString().split("T")[0])
  const [reminderNote, setReminderNote] = useState("")

  // Complétion rapide — mêmes champs que sur le graphe
  const [quickFirstName, setQuickFirstName] = useState("")
  const [quickLastName, setQuickLastName] = useState("")
  const [quickEmail, setQuickEmail] = useState("")
  const [quickPhone, setQuickPhone] = useState("")

  // Éditeur de contact (email de contact, email perso, numéro + type pro/perso)
  const [contactEditOpen, setContactEditOpen] = useState(false)
  const [editEmail, setEditEmail] = useState("")
  const [editPersonalEmail, setEditPersonalEmail] = useState("")
  const [editPhone, setEditPhone] = useState("")
  const [editPhoneType, setEditPhoneType] = useState("")
  const [editAddress, setEditAddress] = useState("")
  const [editPostalCode, setEditPostalCode] = useState("")
  const [editCity, setEditCity] = useState("")

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setQuickFirstName("")
    setQuickLastName("")
    setQuickEmail("")
    setQuickPhone("")
    setContactEditOpen(false)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [client?.id])

  function submitQuickComplete(e: React.FormEvent) {
    e.preventDefault()
    if (!client) return
    const hasInput = quickFirstName.trim() || quickLastName.trim() || quickEmail.trim() || quickPhone.trim()
    if (!hasInput) return
    startQuickTransition(async () => {
      await updateClientAll(client.id, {
        ...(quickFirstName.trim() ? { firstName: quickFirstName.trim() } : {}),
        ...(quickLastName.trim()  ? { lastName: quickLastName.trim() }   : {}),
        ...(quickEmail.trim()     ? { email: quickEmail.trim() }         : {}),
        ...(quickPhone.trim()     ? { phone: quickPhone.trim() }         : {}),
      })
      toast.success("Informations complétées")
      onRefresh?.()
      router.refresh()
    })
  }

  function openContactEdit() {
    if (!client) return
    setEditEmail(client.email ?? "")
    setEditPersonalEmail(client.personalEmail ?? "")
    setEditPhone(client.phone ?? "")
    setEditPhoneType(client.phoneType ?? "")
    setEditAddress(client.address ?? "")
    setEditPostalCode(client.postalCode ?? "")
    setEditCity(client.city ?? "")
    setContactEditOpen(true)
  }
  function submitContactEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!client) return
    startQuickTransition(async () => {
      await updateClientAll(client.id, {
        email: editEmail.trim() || null,
        personalEmail: editPersonalEmail.trim() || null,
        phone: editPhone.trim() || null,
        phoneType: editPhone.trim() ? (editPhoneType || null) : null,
        address: editAddress.trim() || null,
        postalCode: editPostalCode.trim() || null,
        city: editCity.trim() || null,
      })
      toast.success("Contact mis à jour")
      setContactEditOpen(false)
      onRefresh?.()
      router.refresh()
    })
  }

  const fmt = (d: Date | string) =>
    new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })

  function changeType(type: string, label: string) {
    if (!client || !userId) return
    startTransition(async () => {
      await updateClientType(client.id, userId, type)
      toast.success(`Statut mis à jour : ${label}`)
    })
  }

  function submitLog(e: React.FormEvent) {
    e.preventDefault()
    const summary = logSummary.trim()
    if (!summary || !client) return
    startLogTransition(async () => {
      const today = new Date().toISOString().split("T")[0]
      await addInteraction(client.id, { date: today, channel: logChannel, summary })
      // Auto-avance le statut TO_CONTACT → CONTACTED au premier contact
      if (client.type === "PROSPECT" && client.prospectStatus === "TO_CONTACT") {
        await updateProspectStatus(client.id, "CONTACTED")
      }
      setLogSummary("")
      setQuickPanel(null)
      toast.success("Interaction enregistrée")
    })
  }

  function submitReminder(e: React.FormEvent) {
    e.preventDefault()
    if (!client || !reminderDate) return
    startReminderTransition(async () => {
      await addReminder(client.id, { dueDate: reminderDate, note: reminderNote.trim() || undefined })
      setReminderNote("")
      setQuickPanel(null)
      toast.success("Rappel ajouté")
    })
  }

  function pickStatus(status: ProspectStatus) {
    if (!client) return
    setStageDropOpen(false)
    startStageTransition(async () => {
      await updateProspectStatus(client.id, status)
      toast.success(`Statut : ${STATUS_CONFIG[status].label}`)
    })
  }

  if (loading || !client) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-2 text-muted-foreground">
        <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30 border-t-primary animate-spin" />
        <span className="text-sm">Chargement…</span>
      </div>
    )
  }

  const type = typeConfig[client.type as keyof typeof typeConfig]

  const billed = client.invoices
    .filter((i) => i.status === "PAID")
    .reduce((s, i) => s + i.totalHT - i.depositDeducted, 0)
  const pending = client.invoices
    .filter((i) => ["SENT", "LATE"].includes(i.status))
    .reduce((s, i) => s + i.totalHT - i.depositDeducted, 0)

  return (
    <div className="flex flex-col h-full overflow-y-auto">

      {/* Header — pr-10 pour dégager la croix de fermeture du Sheet (absolute top-3 right-3) */}
      <div className="p-5 pr-10 border-b border-border/50 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            {(client.company || client.jobTitle) && (
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  {[client.jobTitle, client.company].filter(Boolean).join(" · ")}
                </span>
              </div>
            )}
            <h2 className="text-xl font-bold">{client.name}</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${type.className}`}>
              {type.label}
            </span>

            {/* Badge statut — visible uniquement pour les prospects */}
            {client.type === "PROSPECT" && (() => {
              const statusCfg = STATUS_CONFIG[client.prospectStatus] ?? STATUS_CONFIG.TO_CONTACT
              return (
                <div className="relative">
                  <button
                    onClick={() => setStageDropOpen((v) => !v)}
                    className={cn("rounded-full border px-2 py-0.5 text-xs font-medium transition-opacity hover:opacity-80", statusCfg.cls)}
                    title="Changer le statut"
                  >
                    {statusCfg.label}
                  </button>

                  {stageDropOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setStageDropOpen(false)} />
                      <div className="absolute right-0 top-full mt-1 z-20 rounded-lg border border-border bg-popover shadow-md p-1 min-w-44">
                        <p className="px-2 py-1 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wide">Pipeline</p>
                        {PIPELINE_STATUSES.map((s) => (
                          <button
                            key={s}
                            onClick={() => pickStatus(s)}
                            className={cn("w-full text-left px-2 py-1 text-xs rounded-md hover:bg-muted transition-colors flex items-center gap-1.5", s === client.prospectStatus && "font-semibold")}
                          >
                            <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", STATUS_CONFIG[s].dot)} />
                            {STATUS_CONFIG[s].label}
                          </button>
                        ))}
                        <p className="px-2 py-1 mt-1 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wide border-t border-border/50 pt-1.5">Résultat</p>
                        {OUTCOME_STATUSES.map((s) => (
                          <button
                            key={s}
                            onClick={() => pickStatus(s)}
                            className={cn("w-full text-left px-2 py-1 text-xs rounded-md hover:bg-muted transition-colors flex items-center gap-1.5", s === client.prospectStatus && "font-semibold")}
                          >
                            <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", STATUS_CONFIG[s].dot)} />
                            {STATUS_CONFIG[s].label}
                            {s === "WON" && <span className="ml-auto text-[9px] text-muted-foreground">→ Client</span>}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )
            })()}

            <Link
              href={`/contacts/${client.id}`}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              title="Ouvrir la fiche complète"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* Contact */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground/50">Contact</span>
            <button
              type="button"
              onClick={() => (contactEditOpen ? setContactEditOpen(false) : openContactEdit())}
              className="p-1 -m-1 rounded text-muted-foreground/50 hover:text-foreground transition-colors"
              title="Ajouter / modifier email, email perso, numéro, adresse"
            >
              <Pencil className="h-3 w-3" />
            </button>
          </div>
          {client.type === "PROSPECT" && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground/70 text-xs">Intérêt :</span>
              <ProspectInterestSelect clientId={client.id} value={client.interestLevel} />
            </div>
          )}
          {client.email && (
            <a href={`mailto:${client.email}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <Mail className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{client.email}</span>
            </a>
          )}
          {client.personalEmail && (
            <a href={`mailto:${client.personalEmail}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <Mail className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{client.personalEmail}</span>
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground shrink-0">perso</span>
            </a>
          )}
          {client.phone && (
            <a href={`tel:${client.phone}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <Phone className="h-3.5 w-3.5 shrink-0" />
              {client.phone}
              {client.phoneType && (
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground shrink-0">
                  {client.phoneType === "PRO" ? "pro" : "perso"}
                </span>
              )}
            </a>
          )}
          {(client.address || client.city) && (
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>{[client.address, [client.postalCode, client.city].filter(Boolean).join(" ")].filter(Boolean).join(", ")}</span>
            </div>
          )}
          {client.websiteUrl && (
            <a href={client.websiteUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <Globe className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{client.websiteUrl.replace(/^https?:\/\//, "")}</span>
              {client.websiteType && (() => {
                const cfg = WEBSITE_TYPE_CONFIG[client.websiteType as WebsiteType]
                return cfg ? <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-medium shrink-0", cfg.cls)}>{cfg.label}</span> : null
              })()}
            </a>
          )}

          {/* Éditeur de contact : email, email perso, numéro + type pro/perso */}
          {contactEditOpen && (
            <form onSubmit={submitContactEdit} className="mt-1.5 space-y-1.5 rounded-lg border border-border bg-muted/20 p-2.5">
              <input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="Email de contact"
                className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <input
                type="email"
                value={editPersonalEmail}
                onChange={(e) => setEditPersonalEmail(e.target.value)}
                placeholder="Email perso (direct)"
                className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <input
                type="tel"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                placeholder="Numéro de téléphone"
                className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring"
              />
              {editPhone.trim() && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground">Numéro :</span>
                  {(["PRO", "PERSO"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setEditPhoneType(editPhoneType === t ? "" : t)}
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors",
                        editPhoneType === t ? "bg-primary text-primary-foreground border-primary" : "border-input text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {t === "PRO" ? "Pro" : "Perso"}
                    </button>
                  ))}
                </div>
              )}
              <input
                type="text"
                value={editAddress}
                onChange={(e) => setEditAddress(e.target.value)}
                placeholder="Adresse"
                className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={editPostalCode}
                  onChange={(e) => setEditPostalCode(e.target.value)}
                  placeholder="CP"
                  className="w-20 h-8 rounded-md border border-input bg-background px-2 text-xs placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <input
                  type="text"
                  value={editCity}
                  onChange={(e) => setEditCity(e.target.value)}
                  placeholder="Ville"
                  className="flex-1 h-8 rounded-md border border-input bg-background px-2 text-xs placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div className="flex justify-end gap-2 pt-0.5">
                <button type="button" onClick={() => setContactEditOpen(false)} className="h-7 px-2.5 rounded-md text-[11px] text-muted-foreground hover:text-foreground transition-colors">Annuler</button>
                <button type="submit" disabled={isSavingQuick} className="h-7 px-3 rounded-md bg-primary text-primary-foreground text-[11px] font-medium hover:opacity-90 disabled:opacity-50 transition-opacity">
                  {isSavingQuick ? "…" : "Enregistrer"}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Complétion rapide — informations manquantes, comme sur le graphe */}
        {isContactIncomplete(client) && (
          <form onSubmit={submitQuickComplete} className="space-y-1.5 rounded-lg border border-amber-500/30 bg-amber-500/8 p-2.5">
            <p className="flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              Informations à compléter
            </p>
            {(!client.firstName || !client.lastName) && (
              <div className="flex gap-1.5">
                <input
                  value={quickFirstName}
                  onChange={(e) => setQuickFirstName(e.target.value)}
                  placeholder="Prénom"
                  className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <input
                  value={quickLastName}
                  onChange={(e) => setQuickLastName(e.target.value)}
                  placeholder="Nom"
                  className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            )}
            {!client.email && !client.phone && (
              <>
                <input
                  type="email"
                  value={quickEmail}
                  onChange={(e) => setQuickEmail(e.target.value)}
                  placeholder="email@exemple.com"
                  className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <input
                  type="tel"
                  value={quickPhone}
                  onChange={(e) => setQuickPhone(e.target.value)}
                  placeholder="+33 6 …"
                  className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </>
            )}
            {(quickFirstName.trim() || quickLastName.trim() || quickEmail.trim() || quickPhone.trim()) && (
              <button
                type="submit"
                disabled={isSavingQuick}
                className="w-full rounded-md bg-amber-600 text-white text-xs font-medium py-1.5 hover:bg-amber-700 disabled:opacity-50 transition-colors"
              >
                {isSavingQuick ? "Enregistrement…" : "Enregistrer"}
              </button>
            )}
          </form>
        )}

        {/* Quick actions */}
        <div className="flex flex-wrap gap-2">
          {client.email && (
            <a
              href={`mailto:${client.email}`}
              className="flex items-center gap-1.5 rounded-lg border border-border/50 px-3 py-1.5 text-xs font-medium hover:bg-muted/50 transition-colors"
            >
              <Mail className="h-3.5 w-3.5" /> E-mail
            </a>
          )}
          {client.phone && (
            <a
              href={`tel:${client.phone}`}
              className="flex items-center gap-1.5 rounded-lg border border-border/50 px-3 py-1.5 text-xs font-medium hover:bg-muted/50 transition-colors"
            >
              <Phone className="h-3.5 w-3.5" /> Appeler
            </a>
          )}
          {client.type === "PROSPECT" && userId && (
            <button
              onClick={() => changeType("CLIENT", "Client")}
              disabled={isPending}
              className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors"
            >
              <UserCheck className="h-3.5 w-3.5" /> Convertir en client
            </button>
          )}
          {(client.type === "PROSPECT" || client.type === "CLIENT") && userId && (
            <button
              onClick={() => changeType("INACTIVE", "Inactif")}
              disabled={isPending}
              className="flex items-center gap-1.5 rounded-lg border border-border/50 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
            >
              <Archive className="h-3.5 w-3.5" /> Archiver
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 border-b border-border/50">
        <div className="p-3 text-center border-r border-border/50">
          <p className="text-lg font-bold">{client._count.projects}</p>
          <p className="text-xs text-muted-foreground">projets</p>
        </div>
        <div className="p-3 text-center border-r border-border/50">
          <p className="text-lg font-bold">{billed > 0 ? `${billed.toLocaleString("fr-FR")}€` : "—"}</p>
          <p className="text-xs text-muted-foreground">facturé</p>
        </div>
        <div className="p-3 text-center">
          <p className={`text-lg font-bold ${pending > 0 ? "text-amber-600" : ""}`}>
            {pending > 0 ? `${pending.toLocaleString("fr-FR")}€` : "—"}
          </p>
          <p className="text-xs text-muted-foreground">en attente</p>
        </div>
      </div>

      <div className="flex-1 p-4 space-y-5">

        {/* ── Log rapide ── */}
        <section className="space-y-2">
          <div className="flex gap-2">
            <button
              onClick={() => setQuickPanel(quickPanel === "log" ? null : "log")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors flex-1 justify-center",
                quickPanel === "log"
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border/50 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
            >
              <MessageSquare className="h-3.5 w-3.5" /> Logguer un contact
            </button>
            <button
              onClick={() => setQuickPanel(quickPanel === "reminder" ? null : "reminder")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors flex-1 justify-center",
                quickPanel === "reminder"
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border/50 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
            >
              <Bell className="h-3.5 w-3.5" /> Ajouter un rappel
            </button>
          </div>

          {/* Formulaire log interaction */}
          {quickPanel === "log" && (
            <form onSubmit={submitLog} className="rounded-lg border border-border/50 bg-muted/20 p-2.5 space-y-2">
              {/* Sélecteur canal */}
              <div className="flex flex-wrap gap-1">
                {(["EMAIL","CALL","MEETING","LINKEDIN","VIDEO","SMS","OTHER"] as const).map((ch) => {
                  const labels: Record<string, string> = {
                    EMAIL: "Email", CALL: "Appel", MEETING: "RDV",
                    LINKEDIN: "LinkedIn", VIDEO: "Visio", SMS: "SMS", OTHER: "Autre",
                  }
                  return (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => setLogChannel(ch)}
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors",
                        logChannel === ch
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {labels[ch]}
                    </button>
                  )
                })}
              </div>
              {/* Résumé */}
              <input
                value={logSummary}
                onChange={(e) => setLogSummary(e.target.value)}
                placeholder="Résumé de l'échange…"
                autoFocus
                className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              {client.type === "PROSPECT" && client.prospectStatus === "TO_CONTACT" && (
                <p className="text-[10px] text-muted-foreground">Le statut passera automatiquement à «&nbsp;Contacté&nbsp;»</p>
              )}
              <div className="flex justify-end gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={() => setQuickPanel(null)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={!logSummary.trim()}
                  className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground disabled:opacity-40 hover:bg-primary/90 transition-colors"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          )}

          {/* Formulaire rappel */}
          {quickPanel === "reminder" && (
            <form onSubmit={submitReminder} className="rounded-lg border border-border/50 bg-muted/20 p-2.5 space-y-2">
              <input
                type="date"
                value={reminderDate}
                onChange={(e) => setReminderDate(e.target.value)}
                required
                className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <input
                value={reminderNote}
                onChange={(e) => setReminderNote(e.target.value)}
                placeholder="Note (optionnel)"
                className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <div className="flex justify-end gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={() => setQuickPanel(null)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={!reminderDate}
                  className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground disabled:opacity-40 hover:bg-primary/90 transition-colors"
                >
                  Ajouter
                </button>
              </div>
            </form>
          )}
        </section>

        {/* Reminders */}
        {client.reminders.length > 0 && (
          <section className="space-y-2">
            <SectionHeader icon={<Bell className="h-3 w-3" />} label="Rappels" href={`/contacts/${client.id}/rappels`} />
            <div className="space-y-1.5">
              {client.reminders.map((r) => {
                const isLate = new Date(r.dueDate) < new Date()
                return (
                  <div key={r.id} className={`flex items-start gap-2 rounded-lg p-2 text-sm ${isLate ? "bg-red-500/5 border border-red-500/20" : "bg-amber-500/5 border border-amber-500/20"}`}>
                    <span className={`text-xs font-medium mt-0.5 shrink-0 ${isLate ? "text-red-500" : "text-amber-600"}`}>
                      {fmt(r.dueDate)}
                    </span>
                    {r.note && <span className="text-xs text-muted-foreground truncate">{r.note}</span>}
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Interactions */}
        {client.interactions.length > 0 && (
          <section className="space-y-2">
            <SectionHeader icon={<MessageSquare className="h-3 w-3" />} label="Interactions" count={client._count.interactions} href={`/contacts/${client.id}/interactions`} />
            <div className="space-y-1.5">
              {client.interactions.map((i) => (
                <div key={i.id} className="flex items-start gap-2 rounded-lg border border-border/50 p-2">
                  <span className="text-muted-foreground mt-0.5 shrink-0">
                    {channelIcon[i.channel] ?? <MessageSquare className="h-3 w-3" />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground mb-0.5">{fmt(i.date)}</p>
                    <p className="text-sm truncate">{i.summary}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Projects */}
        {client.projects.length > 0 && (
          <section className="space-y-2">
            <SectionHeader icon={<FolderKanban className="h-3 w-3" />} label="Projets" count={client._count.projects} href={`/contacts/${client.id}/projets`} />
            <div className="space-y-1.5">
              {client.projects.map((p) => {
                const ps = projectStatusConfig[p.status] ?? { label: p.status, className: "text-muted-foreground" }
                return (
                  <Link
                    key={p.id}
                    href={`/projets/${p.id}`}
                    className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2 hover:bg-muted/50 transition-colors group"
                  >
                    <span className="text-sm font-medium truncate group-hover:text-primary transition-colors">{p.name}</span>
                    <span className={`shrink-0 ml-2 rounded-full border px-2 py-0.5 text-xs font-medium ${ps.className}`}>
                      {ps.label}
                    </span>
                  </Link>
                )
              })}
            </div>
          </section>
        )}

        {/* Invoices */}
        {client.invoices.length > 0 && (
          <section className="space-y-2">
            <SectionHeader icon={<Receipt className="h-3 w-3" />} label="Factures" count={client._count.invoices} href="/facturation/factures" />
            <div className="rounded-lg border border-border/50 overflow-hidden">
              {client.invoices.map((inv, i) => {
                const is = invoiceStatusConfig[inv.status] ?? { label: inv.status, className: "text-muted-foreground" }
                return (
                  <Link
                    key={inv.id}
                    href={`/facturation/factures/${inv.id}`}
                    className={`flex items-center gap-3 px-3 py-2 hover:bg-muted/50 transition-colors group ${i !== 0 ? "border-t border-border/50" : ""}`}
                  >
                    <span className="font-mono text-xs text-muted-foreground shrink-0">{inv.number}</span>
                    <span className={`text-xs font-medium shrink-0 ${is.className}`}>{is.label}</span>
                    <span className="flex-1 text-right text-sm font-semibold group-hover:text-primary transition-colors">
                      {inv.totalHT.toLocaleString("fr-FR")} €
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">{fmt(inv.createdAt)}</span>
                  </Link>
                )
              })}
            </div>
          </section>
        )}

        {/* Quotes */}
        {client.quotes.length > 0 && (
          <section className="space-y-2">
            <SectionHeader icon={<FileText className="h-3 w-3" />} label="Devis" count={client._count.quotes} href="/facturation/devis" />
            <div className="rounded-lg border border-border/50 overflow-hidden">
              {client.quotes.map((q, i) => {
                const qs = quoteStatusConfig[q.status] ?? { label: q.status, className: "text-muted-foreground" }
                return (
                  <Link
                    key={q.id}
                    href={`/facturation/devis/${q.id}`}
                    className={`flex items-center gap-3 px-3 py-2 hover:bg-muted/50 transition-colors group ${i !== 0 ? "border-t border-border/50" : ""}`}
                  >
                    <span className="font-mono text-xs text-muted-foreground shrink-0">{q.number}</span>
                    <span className={`text-xs font-medium shrink-0 ${qs.className}`}>{qs.label}</span>
                    <span className="flex-1 text-right text-sm font-semibold group-hover:text-primary transition-colors">
                      {q.totalHT.toLocaleString("fr-FR")} €
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">{fmt(q.createdAt)}</span>
                  </Link>
                )
              })}
            </div>
          </section>
        )}

        {/* Notes */}
        {client.notes && (
          <section className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes</h3>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{client.notes}</p>
          </section>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border/50">
        <Link
          href={`/contacts/${client.id}`}
          className="flex items-center justify-center gap-2 w-full rounded-lg border border-border/50 px-4 py-2 text-sm font-medium hover:bg-muted/50 transition-colors"
        >
          Ouvrir la fiche complète
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  )
}

function SectionHeader({
  icon,
  label,
  count,
  href,
}: {
  icon: React.ReactNode
  label: string
  count?: number
  href: string
}) {
  return (
    <div className="flex items-center justify-between">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
        {icon} {label}
        {count !== undefined && count > 0 && (
          <span className="ml-1 text-muted-foreground/60 font-normal normal-case tracking-normal">({count})</span>
        )}
      </h3>
      <Link href={href} className="text-xs text-primary hover:underline">Voir tout</Link>
    </div>
  )
}
