"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft, Receipt, CheckSquare, PhoneCall, Coins,
  Phone, Mail, Loader2, Search, Check, ChevronRight,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { useModules, type ModuleId } from "@/hooks/use-modules"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { LinkedinIcon } from "@/components/ui/linkedin-icon"
import { STATUS_CONFIG } from "@/components/modules/prospection/status-config"
import { createExpense, getOrCreateDefaultExpenseCategories } from "@/actions/expense"
import { createClientTask } from "@/actions/projet"
import { searchProspectsQuick, markProspectsContacted } from "@/actions/prospection"
import { getPendingRevenuesQuick, markRevenueReceived } from "@/actions/revenue"
import type { ProspectStatus } from "@/generated/prisma/enums"

type Screen = "menu" | "expense" | "task" | "prospect" | "revenue"

const ACTIONS: {
  screen: Exclude<Screen, "menu">
  moduleId: ModuleId
  icon: React.ElementType
  label: string
  description: string
}[] = [
  { screen: "expense", moduleId: "depenses",    icon: Receipt,     label: "Dépense",             description: "Montant + libellé, c'est noté" },
  { screen: "task",    moduleId: "taches",      icon: CheckSquare, label: "Tâche",               description: "Un truc à ne pas oublier" },
  { screen: "prospect", moduleId: "prospection", icon: PhoneCall,   label: "Interaction prospect", description: "Tracer un appel, email ou message" },
  { screen: "revenue", moduleId: "revenus",     icon: Coins,       label: "Revenu reçu",          description: "Pointer un revenu en attente" },
]

const TITLES: Record<Screen, string> = {
  menu: "Ajout rapide",
  expense: "Nouvelle dépense",
  task: "Nouvelle tâche",
  prospect: "Interaction prospect",
  revenue: "Revenus en attente",
}

/** "YYYY-MM-DD" en heure locale (toISOString décale d'un jour la nuit). */
function localISODate(d: Date): string {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split("T")[0]
}

const inputCls = "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground/50"
const submitCls = "flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
const pillCls = (active: boolean) => cn(
  "flex-1 rounded-lg border py-2 text-xs font-medium transition-all",
  active ? "border-primary/60 bg-primary/10 text-primary" : "border-border text-muted-foreground active:bg-muted/50"
)

/**
 * Bottom sheet mobile de saisies express : menu de 4 actions (gatées par
 * module), puis mini-formulaire au strict minimum. Toast + refresh à la fin.
 */
export function QuickAddSheet({ open, onOpenChange }: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const [screen, setScreen] = useState<Screen>("menu")
  const { isActive } = useModules()
  const router = useRouter()

  const actions = ACTIONS.filter(a => isActive(a.moduleId))

  function handleOpenChange(v: boolean) {
    onOpenChange(v)
    if (!v) setScreen("menu")
  }

  /** Fin d'une saisie : toast, fermeture, refresh des données serveur. */
  function handleDone(message: string) {
    toast.success(message)
    handleOpenChange(false)
    router.refresh()
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="bottom"
        className="sm:hidden gap-0 rounded-t-2xl p-0 max-h-[85dvh] overflow-y-auto pb-[max(env(safe-area-inset-bottom),0.75rem)]"
      >
        <SheetHeader className="flex-row items-center gap-1 border-b border-border/50 px-4 py-3 pr-12">
          {screen !== "menu" && (
            <button
              type="button"
              onClick={() => setScreen("menu")}
              aria-label="Retour au menu"
              className="-ml-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors active:bg-muted"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <SheetTitle>{TITLES[screen]}</SheetTitle>
        </SheetHeader>

        <div className="px-4 py-4">
          {screen === "menu" && (
            <div className="flex flex-col gap-2">
              {actions.map(({ screen: s, icon: Icon, label, description }) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setScreen(s)}
                  className="flex w-full items-center gap-3 rounded-xl border border-border/60 px-4 py-3.5 text-left transition-colors active:bg-muted"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-sm font-medium text-foreground">{label}</span>
                    <span className="truncate text-xs text-muted-foreground">{description}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                </button>
              ))}
              {actions.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Aucun module de saisie rapide actif.
                </p>
              )}
            </div>
          )}
          {screen === "expense" && <ExpenseQuickForm onDone={handleDone} />}
          {screen === "task" && <TaskQuickForm onDone={handleDone} />}
          {screen === "prospect" && <ProspectQuickForm onDone={handleDone} />}
          {screen === "revenue" && <RevenueQuickList />}
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ── Dépense ──────────────────────────────────────────────────────────────────

function ExpenseQuickForm({ onDone }: { onDone: (msg: string) => void }) {
  const [amount, setAmount] = useState("")
  const [label, setLabel] = useState("")
  const [scope, setScope] = useState<"PRO" | "PERSO">("PERSO")
  const [date, setDate] = useState(() => localISODate(new Date()))
  const [categoryId, setCategoryId] = useState("")
  const [categories, setCategories] = useState<{ id: string; name: string }[] | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    let cancelled = false
    getOrCreateDefaultExpenseCategories()
      .then(cats => { if (!cancelled) setCategories(cats) })
      .catch(() => { if (!cancelled) setCategories([]) })
    return () => { cancelled = true }
  }, [])

  const parsedAmount = parseFloat(amount.replace(",", "."))
  const valid = !isNaN(parsedAmount) && parsedAmount > 0 && label.trim().length > 0 && date.length > 0

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid || isPending) return
    const trimmed = label.trim()
    startTransition(async () => {
      try {
        await createExpense({
          label: trimmed,
          amount: parsedAmount,
          date: new Date(date),
          scope,
          categoryId: categoryId || null,
        })
        onDone(`Dépense « ${trimmed} » ajoutée`)
      } catch {
        toast.error("Erreur lors de l'ajout de la dépense")
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="relative">
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          autoFocus
          placeholder="0,00"
          aria-label="Montant"
          className={cn(inputCls, "pr-9 text-2xl font-semibold h-14")}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-lg text-muted-foreground">€</span>
      </div>

      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Libellé (ex : Restaurant, Essence…)"
        aria-label="Libellé"
        className={inputCls}
      />

      <div className="flex gap-2">
        {(["PERSO", "PRO"] as const).map((s) => (
          <button key={s} type="button" onClick={() => setScope(s)} className={pillCls(scope === s)}>
            {s === "PERSO" ? "Perso" : "Pro"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          aria-label="Date"
          className={inputCls}
        />
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          aria-label="Catégorie"
          disabled={categories === null}
          className={cn(inputCls, "disabled:opacity-50")}
        >
          <option value="">{categories === null ? "Catégories…" : "Sans catégorie"}</option>
          {categories?.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <button type="submit" disabled={!valid || isPending} className={submitCls}>
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ajouter la dépense"}
      </button>
    </form>
  )
}

// ── Tâche ────────────────────────────────────────────────────────────────────

const PRIORITY_LABELS: Record<"LOW" | "MEDIUM" | "HIGH" | "URGENT", string> = {
  LOW: "Basse", MEDIUM: "Moyenne", HIGH: "Haute", URGENT: "Urgente",
}

function TaskQuickForm({ onDone }: { onDone: (msg: string) => void }) {
  const [title, setTitle] = useState("")
  const [priority, setPriority] = useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">("MEDIUM")
  const [due, setDue] = useState<"none" | "today" | "tomorrow">("none")
  const [isPending, startTransition] = useTransition()

  const valid = title.trim().length > 0

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid || isPending) return
    const trimmed = title.trim()
    const dueDate = due === "none"
      ? null
      : localISODate(new Date(Date.now() + (due === "tomorrow" ? 86_400_000 : 0)))
    startTransition(async () => {
      try {
        await createClientTask(null, trimmed, dueDate, priority)
        onDone(`Tâche « ${trimmed} » créée`)
      } catch {
        toast.error("Erreur lors de la création de la tâche")
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus
        placeholder="Titre de la tâche…"
        aria-label="Titre"
        className={inputCls}
      />

      <div>
        <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Priorité</p>
        <div className="flex gap-2">
          {(["LOW", "MEDIUM", "HIGH", "URGENT"] as const).map((p) => (
            <button key={p} type="button" onClick={() => setPriority(p)} className={pillCls(priority === p)}>
              {PRIORITY_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Échéance</p>
        <div className="flex gap-2">
          {([["today", "Aujourd'hui"], ["tomorrow", "Demain"], ["none", "Sans date"]] as const).map(([v, l]) => (
            <button key={v} type="button" onClick={() => setDue(v)} className={pillCls(due === v)}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <button type="submit" disabled={!valid || isPending} className={submitCls}>
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Créer la tâche"}
      </button>
    </form>
  )
}

// ── Interaction prospect ─────────────────────────────────────────────────────

type ProspectHit = {
  id: string
  name: string
  company: string | null
  prospectStatus: ProspectStatus
}

const CHANNELS = [
  { value: "CALL" as const,     label: "Tél",      icon: Phone },
  { value: "EMAIL" as const,    label: "Email",    icon: Mail },
  { value: "LINKEDIN" as const, label: "LinkedIn", icon: LinkedinIcon },
]

function ProspectQuickForm({ onDone }: { onDone: (msg: string) => void }) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<ProspectHit[] | null>(null)
  const [selected, setSelected] = useState<ProspectHit | null>(null)
  const [channel, setChannel] = useState<"CALL" | "EMAIL" | "LINKEDIN">("CALL")
  const [note, setNote] = useState("")
  const [isPending, startTransition] = useTransition()

  // Recherche debouncée — annulée si la requête change ou si le champ se vide.
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) return
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const hits = await searchProspectsQuick(q)
        if (!cancelled) setResults(hits)
      } catch {
        if (!cancelled) setResults([])
      }
    }, 250)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [query])

  function handleQueryChange(value: string) {
    setQuery(value)
    if (value.trim().length < 2) setResults(null)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selected || isPending) return
    const prospect = selected
    startTransition(async () => {
      try {
        await markProspectsContacted([prospect.id], channel, note.trim() || undefined)
        onDone(`Interaction avec « ${prospect.name} » enregistrée`)
      } catch {
        toast.error("Erreur lors de l'enregistrement de l'interaction")
      }
    })
  }

  if (!selected) {
    return (
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            autoFocus
            placeholder="Rechercher un prospect…"
            aria-label="Rechercher un prospect"
            className={cn(inputCls, "pl-9")}
          />
        </div>

        {results !== null && results.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">Aucun prospect trouvé.</p>
        )}
        {results !== null && results.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {results.map((p) => {
              const status = STATUS_CONFIG[p.prospectStatus]
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelected(p)}
                  className="flex w-full items-center gap-3 rounded-xl border border-border/60 px-3 py-2.5 text-left transition-colors active:bg-muted"
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium text-foreground">{p.name}</span>
                    {p.company && <span className="truncate text-xs text-muted-foreground">{p.company}</span>}
                  </span>
                  <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium", status.cls)}>
                    {status.label}
                  </span>
                </button>
              )
            })}
          </div>
        )}
        {results === null && (
          <p className="py-4 text-center text-xs text-muted-foreground">
            Tape au moins 2 caractères pour chercher.
          </p>
        )}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2.5">
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium text-foreground">{selected.name}</span>
          {selected.company && <span className="truncate text-xs text-muted-foreground">{selected.company}</span>}
        </span>
        <button
          type="button"
          onClick={() => setSelected(null)}
          className="shrink-0 text-xs font-medium text-primary"
        >
          Changer
        </button>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Canal</p>
        <div className="flex gap-2">
          {CHANNELS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setChannel(value)}
              className={cn(pillCls(channel === value), "flex items-center justify-center gap-1.5")}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        placeholder="Note courte (optionnel)…"
        aria-label="Note"
        className={cn(inputCls, "resize-none")}
      />

      <button type="submit" disabled={isPending} className={submitCls}>
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enregistrer l'interaction"}
      </button>
    </form>
  )
}

// ── Revenu reçu ──────────────────────────────────────────────────────────────

type PendingRevenue = {
  id: string
  label: string
  amount: number
  expectedAt: Date | null
}

function formatEuro(n: number): string {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + " €"
}

/**
 * Checklist des revenus en attente : un tap = reçu aujourd'hui par virement.
 * Le sheet reste ouvert pour pointer plusieurs revenus d'affilée.
 */
function RevenueQuickList() {
  const [revenues, setRevenues] = useState<PendingRevenue[] | null>(null)
  const [failed, setFailed] = useState(false)
  const router = useRouter()

  useEffect(() => {
    let cancelled = false
    getPendingRevenuesQuick()
      .then(rows => { if (!cancelled) setRevenues(rows) })
      .catch(() => { if (!cancelled) { setRevenues([]); setFailed(true) } })
    return () => { cancelled = true }
  }, [])

  function handleMark(rev: PendingRevenue) {
    // Retrait optimiste — réinséré (retrié par date) si le serveur refuse.
    setRevenues(prev => prev?.filter(r => r.id !== rev.id) ?? prev)
    void (async () => {
      const res = await markRevenueReceived(rev.id, new Date(), "VIREMENT")
      if (res.error) {
        setRevenues(prev => prev
          ? [...prev, rev].sort((a, b) =>
              (a.expectedAt ? new Date(a.expectedAt).getTime() : Infinity)
              - (b.expectedAt ? new Date(b.expectedAt).getTime() : Infinity))
          : prev)
        toast.error(res.error)
        return
      }
      toast.success(`Revenu « ${rev.label} » marqué reçu`)
      router.refresh()
    })()
  }

  if (revenues === null) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (revenues.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        {failed ? "Impossible de charger les revenus." : "Aucun revenu en attente — tout est encaissé."}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      <p className="mb-1 text-xs text-muted-foreground">
        Un tap = reçu aujourd&apos;hui par virement.
      </p>
      {revenues.map((rev) => (
        <button
          key={rev.id}
          type="button"
          onClick={() => handleMark(rev)}
          className="flex w-full items-center gap-3 rounded-xl border border-border/60 px-3 py-2.5 text-left transition-colors active:bg-muted"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-emerald-500/40 text-emerald-500">
            <Check className="h-4 w-4" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium text-foreground">{rev.label}</span>
            {rev.expectedAt && (
              <span className="text-xs text-muted-foreground">
                Attendu le {new Date(rev.expectedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
              </span>
            )}
          </span>
          <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
            {formatEuro(rev.amount)}
          </span>
        </button>
      ))}
    </div>
  )
}
