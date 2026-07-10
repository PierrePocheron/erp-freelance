"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { Search, X, Mail, Phone, Trash2, ChevronLeft, ChevronRight, Send, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { useSortState, cmp } from "@/hooks/use-sortable"
import { Th } from "@/components/ui/sortable-header"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { ClientPanel } from "@/components/modules/crm/ClientPanel"
import { getClientPanel } from "@/actions/crm"
import { markProspectsContacted, updateProspectsStatusBulk, deleteProspects } from "@/actions/prospection"
import { STATUS_CONFIG, ALL_STATUSES, WEBSITE_TYPE_CONFIG, SOURCE_LABELS } from "./status-config"
import { ProspectStatusSelect } from "./ProspectStatusSelect"
import { SendEmailDialog, type EmailTemplateOption } from "./SendEmailDialog"
import { GmailPrepDialog } from "./GmailPrepDialog"
import type { ProspectStatus, WebsiteType, InteractionChannel } from "@/generated/prisma/enums"

type Prospect = {
  id: string
  name: string
  firstName: string | null
  lastName: string | null
  company: string | null
  email: string | null
  phone: string | null
  source: string
  prospectStatus: string
  websiteUrl: string | null
  websiteType: string | null
  city: string | null
  region: string | null
  businessDescription: string | null
  createdAt: Date | string
  _count: { interactions: number }
  interactions: { date: Date | string; channel: string }[]
}

type PanelData = Awaited<ReturnType<typeof getClientPanel>>

const PAGE_SIZES = [25, 50, 100, 0] // 0 = tous
const PAGE_SIZE_KEY = "erp-prospection-pagesize"

const fmtShort = (d: Date | string) =>
  new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "2-digit" })

export function ProspectionTable({
  prospects,
  userId,
  initialStatus,
  templates,
  emailFromConfigured,
}: {
  prospects: Prospect[]
  userId: string
  initialStatus?: ProspectStatus
  templates: EmailTemplateOption[]
  emailFromConfigured: boolean
}) {
  const [statusFilter, setStatusFilter] = useState<ProspectStatus | "ALL">(initialStatus ?? "ALL")
  const [search, setSearch] = useState("")
  const [siteTypeFilter, setSiteTypeFilter] = useState<string>("ALL")
  const [sourceFilter, setSourceFilter] = useState<string>("ALL")
  const { sortCol, sortDir, toggle } = useSortState("createdAt", "desc")

  // Pagination
  const [pageSize, setPageSize] = useState(50)
  const [page, setPage] = useState(1)
  useEffect(() => {
    const stored = localStorage.getItem(PAGE_SIZE_KEY)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored !== null) setPageSize(Number(stored))
  }, [])
  function changePageSize(n: number) {
    setPageSize(n)
    setPage(1)
    localStorage.setItem(PAGE_SIZE_KEY, String(n))
  }

  // Sélection
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const headerCheckboxRef = useRef<HTMLInputElement>(null)
  const [isBulkPending, startBulk] = useTransition()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [contactMenuOpen, setContactMenuOpen] = useState(false)
  const [statusMenuOpen, setStatusMenuOpen] = useState(false)
  const [sendEmailOpen, setSendEmailOpen] = useState(false)
  const [gmailPrepOpen, setGmailPrepOpen] = useState(false)

  // Panel contact
  const [panelOpen, setPanelOpen] = useState(false)
  const [panelData, setPanelData] = useState<PanelData>(null)
  const [isPanelPending, startPanel] = useTransition()

  function openClient(clientId: string) {
    setPanelOpen(true)
    setPanelData(null)
    startPanel(async () => {
      const data = await getClientPanel(clientId, userId)
      setPanelData(data)
    })
  }

  // ── Filtre + tri + pagination (en mémoire) ────────────────────────────────
  const needle = search.trim().toLowerCase()
  const filtered = useMemo(() => {
    const rows = prospects
      .filter((p) => statusFilter === "ALL" || p.prospectStatus === statusFilter)
      .filter((p) => siteTypeFilter === "ALL" || p.websiteType === siteTypeFilter)
      .filter((p) => sourceFilter === "ALL" || p.source === sourceFilter)
      .filter((p) =>
        !needle ||
        p.name.toLowerCase().includes(needle) ||
        (p.company ?? "").toLowerCase().includes(needle) ||
        (p.email ?? "").toLowerCase().includes(needle) ||
        (p.region ?? "").toLowerCase().includes(needle) ||
        (p.websiteUrl ?? "").toLowerCase().includes(needle)
      )
    const statusOrder = Object.fromEntries(ALL_STATUSES.map((s, i) => [s, i]))
    // Les issues closes sont parquées en bas quel que soit le tri de colonne :
    // « Perdu » tout en bas, « Gagné » juste au-dessus (demande de Pierre).
    const outcomeRank = (status: string) => (status === "LOST" ? 2 : status === "WON" ? 1 : 0)
    return [...rows].sort((a, b) => {
      const byOutcome = outcomeRank(a.prospectStatus) - outcomeRank(b.prospectStatus)
      if (byOutcome !== 0) return byOutcome
      switch (sortCol) {
        case "name":        return cmp(a.name, b.name, sortDir)
        case "company":     return cmp(a.company, b.company, sortDir)
        case "email":       return cmp(a.email, b.email, sortDir)
        case "status":      return cmp(statusOrder[a.prospectStatus] ?? 99, statusOrder[b.prospectStatus] ?? 99, sortDir)
        case "websiteType": return cmp(a.websiteType, b.websiteType, sortDir)
        case "region":      return cmp(a.region, b.region, sortDir)
        case "lastContact": return cmp(
          a.interactions[0] ? new Date(a.interactions[0].date) : null,
          b.interactions[0] ? new Date(b.interactions[0].date) : null,
          sortDir,
        )
        case "source":      return cmp(SOURCE_LABELS[a.source] ?? a.source, SOURCE_LABELS[b.source] ?? b.source, sortDir)
        case "createdAt":   return cmp(new Date(a.createdAt), new Date(b.createdAt), sortDir)
        default:            return 0
      }
    })
  }, [prospects, statusFilter, siteTypeFilter, sourceFilter, needle, sortCol, sortDir])

  const totalPages = pageSize === 0 ? 1 : Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const paged = pageSize === 0 ? filtered : filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

  // Reset pagination quand les filtres changent
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1)
  }, [statusFilter, siteTypeFilter, sourceFilter, needle])

  // ── Sélection ─────────────────────────────────────────────────────────────
  const pagedIds = paged.map((p) => p.id)
  const allPagedSelected = pagedIds.length > 0 && pagedIds.every((id) => selected.has(id))
  const somePagedSelected = pagedIds.some((id) => selected.has(id))

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = somePagedSelected && !allPagedSelected
    }
  }, [somePagedSelected, allPagedSelected])

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAllPaged() {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allPagedSelected) pagedIds.forEach((id) => next.delete(id))
      else pagedIds.forEach((id) => next.add(id))
      return next
    })
  }

  const selectedIds = [...selected]
  const selectedProspects = prospects.filter((p) => selected.has(p.id))

  function bulkContact(channel: InteractionChannel) {
    setContactMenuOpen(false)
    startBulk(async () => {
      const { contacted } = await markProspectsContacted(selectedIds, channel)
      setSelected(new Set())
      toast.success(`${contacted} prospect${contacted > 1 ? "s" : ""} marqué${contacted > 1 ? "s" : ""} contacté${contacted > 1 ? "s" : ""}`)
    })
  }

  function bulkStatus(status: ProspectStatus) {
    setStatusMenuOpen(false)
    startBulk(async () => {
      await updateProspectsStatusBulk(selectedIds, status)
      setSelected(new Set())
      toast.success(`Statut mis à jour (${selectedIds.length})`)
    })
  }

  function bulkDelete() {
    setConfirmDelete(false)
    startBulk(async () => {
      const { deleted } = await deleteProspects(selectedIds)
      setSelected(new Set())
      toast.success(`${deleted} prospect${deleted > 1 ? "s" : ""} supprimé${deleted > 1 ? "s" : ""}`)
    })
  }

  // Comptages par statut pour les pills
  const countByStatus = Object.fromEntries(
    ALL_STATUSES.map((s) => [s, prospects.filter((p) => p.prospectStatus === s).length])
  )

  if (prospects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-10 text-center">
        <p className="text-sm text-muted-foreground">Aucun prospect pour le moment</p>
        <p className="text-xs text-muted-foreground/60 mt-1">Ajout rapide ci-dessus, ou import CSV à venir</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* ── Pills statut ── */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          onClick={() => setStatusFilter("ALL")}
          className={cn(
            "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
            statusFilter === "ALL" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted"
          )}
        >
          Tous ({prospects.length})
        </button>
        {ALL_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(statusFilter === s ? "ALL" : s)}
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-opacity hover:opacity-80",
              STATUS_CONFIG[s].cls,
              statusFilter === s && "ring-1 ring-foreground/40"
            )}
          >
            {STATUS_CONFIG[s].label} ({countByStatus[s]})
          </button>
        ))}
      </div>

      {/* ── Recherche + filtres secondaires ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher (nom, email, société, région, site)…"
            className="w-full h-8 rounded-lg border border-input bg-transparent pl-8 pr-7 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <select
          value={siteTypeFilter}
          onChange={(e) => setSiteTypeFilter(e.target.value)}
          className="h-8 rounded-lg border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="ALL">Type de site : tous</option>
          {(Object.keys(WEBSITE_TYPE_CONFIG) as WebsiteType[]).map((t) => (
            <option key={t} value={t}>{WEBSITE_TYPE_CONFIG[t].label}</option>
          ))}
        </select>
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="h-8 rounded-lg border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="ALL">Source : toutes</option>
          {Object.entries(SOURCE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>

      {/* ── Barre d'actions en lot ── */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
          <span className="text-xs font-medium">{selected.size} sélectionné{selected.size > 1 ? "s" : ""}</span>

          <div className="relative">
            <button
              onClick={() => { setContactMenuOpen((v) => !v); setStatusMenuOpen(false) }}
              disabled={isBulkPending}
              className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg border border-input bg-background text-xs font-medium hover:bg-muted transition-colors disabled:opacity-50"
            >
              <Mail className="h-3 w-3" /> Marquer contacté ▾
            </button>
            {contactMenuOpen && (
              <>
                <div aria-hidden="true" className="fixed inset-0 z-10" onClick={() => setContactMenuOpen(false)} />
                <div className="absolute left-0 top-full mt-1 z-20 rounded-lg border border-border bg-popover shadow-md p-1 min-w-36">
                  <button onClick={() => bulkContact("EMAIL")} className="w-full text-left px-2 py-1 text-xs rounded-md hover:bg-muted transition-colors flex items-center gap-2">
                    <Mail className="h-3 w-3" /> Par email
                  </button>
                  <button onClick={() => bulkContact("CALL")} className="w-full text-left px-2 py-1 text-xs rounded-md hover:bg-muted transition-colors flex items-center gap-2">
                    <Phone className="h-3 w-3" /> Par téléphone
                  </button>
                  <button onClick={() => bulkContact("LINKEDIN")} className="w-full text-left px-2 py-1 text-xs rounded-md hover:bg-muted transition-colors flex items-center gap-2">
                    <span className="text-[10px] font-bold w-3 text-center">in</span> Par LinkedIn
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="relative">
            <button
              onClick={() => { setStatusMenuOpen((v) => !v); setContactMenuOpen(false) }}
              disabled={isBulkPending}
              className="h-7 px-2.5 rounded-lg border border-input bg-background text-xs font-medium hover:bg-muted transition-colors disabled:opacity-50"
            >
              Changer statut ▾
            </button>
            {statusMenuOpen && (
              <>
                <div aria-hidden="true" className="fixed inset-0 z-10" onClick={() => setStatusMenuOpen(false)} />
                <div className="absolute left-0 top-full mt-1 z-20 rounded-lg border border-border bg-popover shadow-md p-1 min-w-40">
                  {ALL_STATUSES.map((s) => (
                    <button key={s} onClick={() => bulkStatus(s)} className="w-full text-left px-2 py-1 text-xs rounded-md hover:bg-muted transition-colors flex items-center gap-2">
                      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", STATUS_CONFIG[s].dot)} />
                      {STATUS_CONFIG[s].label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <button
            onClick={() => setSendEmailOpen(true)}
            disabled={isBulkPending}
            className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg border border-input bg-background text-xs font-medium hover:bg-muted transition-colors disabled:opacity-50"
          >
            <Send className="h-3 w-3" /> Envoyer email
          </button>
          <button
            onClick={() => setGmailPrepOpen(true)}
            disabled={isBulkPending}
            className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg border border-input bg-background text-xs font-medium hover:bg-muted transition-colors disabled:opacity-50"
          >
            <ExternalLink className="h-3 w-3" /> Préparer Gmail
          </button>

          <div className="ml-auto flex items-center gap-2">
            {confirmDelete ? (
              <>
                <button onClick={bulkDelete} disabled={isBulkPending} className="text-xs font-medium text-destructive hover:opacity-80 disabled:opacity-50">
                  Confirmer la suppression
                </button>
                <button onClick={() => setConfirmDelete(false)} className="text-xs text-muted-foreground hover:text-foreground">
                  Non
                </button>
              </>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                disabled={isBulkPending}
                className="flex items-center gap-1 h-7 px-2 rounded-lg text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
              >
                <Trash2 className="h-3 w-3" /> Supprimer
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Tableau ── */}
      <div className="rounded-xl border border-border/50 bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50 [&>th]:px-3 [&>th]:py-2 text-left">
              <th className="w-8">
                <input
                  ref={headerCheckboxRef}
                  type="checkbox"
                  checked={allPagedSelected}
                  onChange={toggleAllPaged}
                  className="h-3.5 w-3.5 rounded accent-primary align-middle"
                />
              </th>
              <Th label="Nom"             col="name"        sortCol={sortCol} sortDir={sortDir} onSort={toggle} />
              <Th label="Société"         col="company"     sortCol={sortCol} sortDir={sortDir} onSort={toggle} className="hidden md:table-cell" />
              <Th label="Email"           col="email"       sortCol={sortCol} sortDir={sortDir} onSort={toggle} className="hidden lg:table-cell" />
              <Th label="Statut"          col="status"      sortCol={sortCol} sortDir={sortDir} onSort={toggle} />
              <Th label="Site"            col="websiteType" sortCol={sortCol} sortDir={sortDir} onSort={toggle} className="hidden xl:table-cell" />
              <Th label="Région"          col="region"      sortCol={sortCol} sortDir={sortDir} onSort={toggle} className="hidden xl:table-cell" />
              <Th label="Dernier contact" col="lastContact" sortCol={sortCol} sortDir={sortDir} onSort={toggle} className="hidden md:table-cell" />
              <Th label="Source"          col="source"      sortCol={sortCol} sortDir={sortDir} onSort={toggle} className="hidden lg:table-cell" />
              <Th label="Ajouté"          col="createdAt"   sortCol={sortCol} sortDir={sortDir} onSort={toggle} className="hidden sm:table-cell" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {paged.map((p) => {
              const last = p.interactions[0]
              const siteType = p.websiteType ? WEBSITE_TYPE_CONFIG[p.websiteType as WebsiteType] : null
              return (
                <tr
                  key={p.id}
                  onClick={() => openClient(p.id)}
                  className={cn(
                    "cursor-pointer hover:bg-muted/40 transition-colors [&>td]:px-3 [&>td]:py-2",
                    selected.has(p.id) && "bg-primary/5"
                  )}
                >
                  <td onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(p.id)}
                      onChange={() => toggleRow(p.id)}
                      className="h-3.5 w-3.5 rounded accent-primary align-middle"
                    />
                  </td>
                  <td className="font-medium max-w-[180px] truncate" title={p.name}>{p.name}</td>
                  <td className="hidden md:table-cell text-muted-foreground max-w-[140px] truncate" title={p.company ?? undefined}>{p.company ?? "—"}</td>
                  <td className="hidden lg:table-cell text-muted-foreground max-w-[200px] truncate" title={p.email ?? undefined}>{p.email ?? "—"}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <ProspectStatusSelect clientId={p.id} value={p.prospectStatus} />
                  </td>
                  <td className="hidden xl:table-cell">
                    {siteType
                      ? <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap", siteType.cls)}>{siteType.label}</span>
                      : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="hidden xl:table-cell text-muted-foreground max-w-[110px] truncate" title={p.region ?? undefined}>{p.region ?? "—"}</td>
                  <td className="hidden md:table-cell text-xs text-muted-foreground whitespace-nowrap">
                    {last ? fmtShort(last.date) : <span className="text-amber-600 font-medium">Jamais</span>}
                  </td>
                  <td className="hidden lg:table-cell text-xs text-muted-foreground whitespace-nowrap">{SOURCE_LABELS[p.source] ?? p.source}</td>
                  <td className="hidden sm:table-cell text-xs text-muted-foreground whitespace-nowrap">{fmtShort(p.createdAt)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── Footer pagination ── */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span>
          {filtered.length === 0
            ? "Aucun résultat"
            : pageSize === 0
              ? `${filtered.length} ligne${filtered.length > 1 ? "s" : ""}`
              : `${(safePage - 1) * pageSize + 1}–${Math.min(safePage * pageSize, filtered.length)} sur ${filtered.length}`}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <select
            value={pageSize}
            onChange={(e) => changePageSize(Number(e.target.value))}
            className="h-7 rounded-lg border border-input bg-background px-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>{n === 0 ? "Tous" : `${n} / page`}</option>
            ))}
          </select>
          {pageSize !== 0 && totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="h-7 w-7 flex items-center justify-center rounded-lg border border-input hover:bg-muted transition-colors disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span className="px-1 tabular-nums">{safePage}/{totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="h-7 w-7 flex items-center justify-center rounded-lg border border-input hover:bg-muted transition-colors disabled:opacity-40"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Sheet fiche contact ── */}
      <Sheet open={panelOpen} onOpenChange={setPanelOpen}>
        <SheetContent side="right" className="w-[460px] sm:max-w-[460px] p-0" showCloseButton>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <ClientPanel client={panelData as any} loading={isPanelPending || (panelOpen && panelData === null)} userId={userId} />
        </SheetContent>
      </Sheet>

      {/* ── Emailing ── */}
      <SendEmailDialog
        open={sendEmailOpen}
        onOpenChange={setSendEmailOpen}
        templates={templates}
        targets={selectedProspects}
        emailFromConfigured={emailFromConfigured}
        onSent={() => setSelected(new Set())}
      />
      <GmailPrepDialog
        open={gmailPrepOpen}
        onOpenChange={setGmailPrepOpen}
        templates={templates}
        targets={selectedProspects}
        onDone={() => setSelected(new Set())}
      />
    </div>
  )
}
