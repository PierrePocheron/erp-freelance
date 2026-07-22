"use client"

import { useState, useTransition } from "react"
import { getClientPanel } from "@/actions/crm"
import { ClientPanel } from "./ClientPanel"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { LayoutGrid, List, Search, TrendingUp, AlertCircle } from "lucide-react"

function fmtEur(n: number) {
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " €"
}
import { cn } from "@/lib/utils"
import { CLIENT_SOURCE_LABELS as sourceLabels } from "@/lib/client-source"

const typeConfig = {
  TO_COMPLETE: { label: "À compléter", className: "bg-rose-500/15 text-rose-600 border-rose-500/20" },
  PROSPECT:    { label: "Prospect",    className: "bg-amber-500/15 text-amber-600 border-amber-500/20" },
  CLIENT:      { label: "Client",      className: "bg-emerald-500/15 text-emerald-600 border-emerald-500/20" },
  PERSONAL:    { label: "Perso",       className: "bg-violet-500/15 text-violet-600 border-violet-500/20" },
  RECRUITER:   { label: "Recruteur",   className: "bg-sky-500/15 text-sky-600 border-sky-500/20" },
  SELF:        { label: "Perso",       className: "bg-indigo-500/15 text-indigo-600 border-indigo-500/20" },
  INACTIVE:    { label: "Inactif",     className: "bg-muted text-muted-foreground border-border" },
}

type Client = {
  id: string
  name: string
  company: string | null
  email: string | null
  type: string
  source: string
  createdAt: Date | string
  _count: { interactions: number; projects: number }
  interactions: { date: Date | string; channel: string }[]
  reminders: { dueDate: Date | string }[]
  billing: { totalFacture: number; totalEncaisse: number }
  incomplete?: boolean
}

type Group = { key: string; label: string; items: Client[] }
type PanelData = Awaited<ReturnType<typeof getClientPanel>>
type View = "cards" | "list"

const fmtShort = (d: Date | string) =>
  new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })

const fmtSince = (d: Date | string) =>
  new Date(d).toLocaleDateString("fr-FR", { month: "short", year: "numeric" })

export function CrmList({ groups, userId }: { groups: Group[]; userId: string }) {
  const [open, setOpen] = useState(false)
  const [panelData, setPanelData] = useState<PanelData>(null)
  const [isPending, startTransition] = useTransition()
  const [view, setView] = useState<View>("cards")
  const [search, setSearch] = useState("")
  const [showBilling, setShowBilling] = useState(false)

  function openClient(clientId: string) {
    setOpen(true)
    setPanelData(null)
    startTransition(async () => {
      const data = await getClientPanel(clientId, userId)
      setPanelData(data)
    })
  }

  const q = search.toLowerCase().trim()
  const filteredGroups = groups.map((g) => ({
    ...g,
    items: q
      ? g.items.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            (c.company ?? "").toLowerCase().includes(q) ||
            (c.email ?? "").toLowerCase().includes(q)
        )
      : g.items,
  }))

  const hasClients = groups.some((g) => g.items.length > 0)
  const hasResults = filteredGroups.some((g) => g.items.length > 0)

  return (
    <>
      {!hasClients ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
          <p className="font-medium">Aucun contact</p>
          <p className="text-sm text-muted-foreground mt-1">Ajoutez votre premier prospect ou client</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Search + toggles */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher..."
                className="h-8 w-full rounded-lg border border-input bg-transparent pl-8 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            <button
              onClick={() => setShowBilling((v) => !v)}
              className={cn(
                "flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-medium border transition-colors",
                showBilling
                  ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20"
                  : "text-muted-foreground border-border hover:bg-muted/50 hover:text-foreground"
              )}
              title="Afficher la facturation"
            >
              <TrendingUp className="h-3.5 w-3.5" />
              Facturation
            </button>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setView("cards")}
                className={cn(
                  "flex items-center justify-center h-8 w-8 rounded-lg transition-colors",
                  view === "cards"
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
                title="Vue cartes"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setView("list")}
                className={cn(
                  "flex items-center justify-center h-8 w-8 rounded-lg transition-colors",
                  view === "list"
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
                title="Vue liste"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>

          {!hasResults && q && (
            <p className="text-sm text-muted-foreground italic">Aucun résultat pour « {q} »</p>
          )}

          {filteredGroups.map(({ key, label, items }) =>
            items.length === 0 ? null : (
              <section key={key} className="space-y-3">
                <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  {label}
                  <span className="ml-1.5 text-xs font-normal">({items.length})</span>
                </h2>

                {view === "cards" ? (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((client) => (
                      <CardItem key={client.id} client={client} showBilling={showBilling} onClick={() => openClient(client.id)} />
                    ))}
                  </div>
                ) : (
                  <ListSection items={items} showBilling={showBilling} onOpen={openClient} />
                )}
              </section>
            )
          )}
        </div>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-[460px] sm:max-w-[460px] p-0" showCloseButton={true}>
          <ClientPanel
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            client={panelData as any}
            loading={isPending || (open && panelData === null)}
            userId={userId}
            onRefresh={() => panelData && openClient(panelData.id)}
          />
        </SheetContent>
      </Sheet>
    </>
  )
}

function CardItem({ client, showBilling, onClick }: { client: Client; showBilling: boolean; onClick: () => void }) {
  const type = typeConfig[client.type as keyof typeof typeConfig]
  const lastInteraction = client.interactions[0]
  const nextReminder = client.reminders[0]
  const hasBilling = client.billing.totalFacture > 0
  const billPct = hasBilling ? Math.min(100, (client.billing.totalEncaisse / client.billing.totalFacture) * 100) : 0

  return (
    <button
      onClick={onClick}
      className="group rounded-xl border border-border/50 bg-card p-3 hover:border-border hover:shadow-sm transition-all space-y-2 text-left w-full"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <p className="text-xs text-muted-foreground truncate">
              {client.company ?? sourceLabels[client.source] ?? "—"}
            </p>
          </div>
          <p className="font-semibold text-sm group-hover:text-primary transition-colors flex items-center gap-1">
            <span className="truncate min-w-0">{client.name}</span>
            {client.incomplete && (
              <span title="Informations à compléter" className="inline-flex shrink-0">
                <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
              </span>
            )}
          </p>
          {client.email && <p className="text-xs text-muted-foreground truncate">{client.email}</p>}
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${type.className}`}>
          {type.label}
        </span>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
        <span>Depuis {fmtSince(client.createdAt)}</span>
        {lastInteraction && (
          <>
            <span className="text-border">·</span>
            <span>Contact {fmtShort(lastInteraction.date)}</span>
          </>
        )}
        {nextReminder && (
          <>
            <span className="text-border">·</span>
            <span className={new Date(nextReminder.dueDate) < new Date() ? "text-red-500 font-medium" : "text-amber-600"}>
              ⏰ {fmtShort(nextReminder.dueDate)}
            </span>
          </>
        )}
        {client._count.projects > 0 && (
          <span className="ml-auto shrink-0">
            {client._count.projects} projet{client._count.projects !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {showBilling && (
        <div className={cn("pt-2 border-t border-border/50 space-y-1.5", !hasBilling && "opacity-40")}>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Facturation</span>
            {hasBilling ? (
              <span>
                <span className="font-medium">{fmtEur(client.billing.totalEncaisse)}</span>
                <span className="text-muted-foreground"> / {fmtEur(client.billing.totalFacture)}</span>
              </span>
            ) : (
              <span className="text-muted-foreground">Aucune facture</span>
            )}
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${billPct}%` }}
            />
          </div>
        </div>
      )}
    </button>
  )
}

function ListSection({ items, showBilling, onOpen }: { items: Client[]; showBilling: boolean; onOpen: (id: string) => void }) {
  return (
    <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
      {items.map((client, i) => {
        const type = typeConfig[client.type as keyof typeof typeConfig]
        const lastInteraction = client.interactions[0]
        const nextReminder = client.reminders[0]
        const hasBilling = client.billing.totalFacture > 0
        const billPct = hasBilling ? Math.min(100, (client.billing.totalEncaisse / client.billing.totalFacture) * 100) : 0

        return (
          <button
            key={client.id}
            onClick={() => onOpen(client.id)}
            className={cn(
              "w-full flex items-center gap-4 px-4 py-2.5 hover:bg-muted/50 transition-colors text-left",
              i !== 0 && "border-t border-border/50"
            )}
          >
            {/* Nom + société */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium flex items-center gap-1">
                <span className="truncate min-w-0">{client.name}</span>
                {client.incomplete && (
                  <span title="Informations à compléter" className="inline-flex shrink-0">
                    <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                  </span>
                )}
              </p>
              {client.company && (
                <p className="text-xs text-muted-foreground truncate">{client.company}</p>
              )}
            </div>

            {/* Type */}
            <span className={`shrink-0 hidden sm:inline-flex rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${type.className}`}>
              {type.label}
            </span>

            {/* Facturation (conditionnel) */}
            {showBilling && (
              <div className="shrink-0 hidden md:flex flex-col items-end gap-1 w-40">
                {hasBilling ? (
                  <>
                    <span className="text-xs">
                      <span className="font-medium">{fmtEur(client.billing.totalEncaisse)}</span>
                      <span className="text-muted-foreground"> / {fmtEur(client.billing.totalFacture)}</span>
                    </span>
                    <div className="h-1 w-24 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{ width: `${billPct}%` }}
                      />
                    </div>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </div>
            )}

            {/* Depuis */}
            <span className="shrink-0 hidden md:block text-xs text-muted-foreground w-28 text-right">
              Depuis {fmtSince(client.createdAt)}
            </span>

            {/* Dernier contact */}
            <span className="shrink-0 hidden lg:block text-xs text-muted-foreground w-28 text-right">
              {lastInteraction ? `Contact ${fmtShort(lastInteraction.date)}` : "—"}
            </span>

            {/* Rappel */}
            <span className={cn(
              "shrink-0 hidden lg:block text-xs w-20 text-right",
              nextReminder
                ? new Date(nextReminder.dueDate) < new Date()
                  ? "text-red-500 font-medium"
                  : "text-amber-600"
                : "text-muted-foreground"
            )}>
              {nextReminder ? `⏰ ${fmtShort(nextReminder.dueDate)}` : "—"}
            </span>

            {/* Projets */}
            <span className="shrink-0 hidden sm:block text-xs text-muted-foreground w-16 text-right">
              {client._count.projects > 0
                ? `${client._count.projects} projet${client._count.projects !== 1 ? "s" : ""}`
                : "—"}
            </span>
          </button>
        )
      })}
    </div>
  )
}
