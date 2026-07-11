"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { AlertCircle, Building2, Check, ExternalLink, Repeat, Wallet } from "lucide-react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { ContactRow, type IncompleteContact } from "@/components/modules/crm/IncompleteContactsSheet"
import { updateCompany } from "@/actions/crm"
import { updateRevenue } from "@/actions/revenue"
import { confirmRecurringExpenseDate } from "@/actions/expense"

// Ouvre le volet depuis n'importe où (carte « À traiter » de l'accueil mobile).
export const OPEN_INCOMPLETE_SHEET_EVENT = "erp:open-incomplete-sheet"

export type IncompleteCompany = { id: string; name: string }
export type IncompleteRevenue = { id: string; label: string; amount: number }
export type IncompleteRecurring = { id: string; label: string; amount: number }
export type AssocOption = { id: string; name: string }

type Props = {
  contacts: IncompleteContact[]
  companies: IncompleteCompany[]
  revenues: IncompleteRevenue[]
  recurringExpenses: IncompleteRecurring[]
  /** Listes d'association pour les revenus (déjà fetchées par le dashboard) */
  allCompanies: AssocOption[]
  allClients: AssocOption[]
  allProjects: AssocOption[]
  /** Lien « voir dans le graphe » affiché si le module graph est actif */
  showGraphLink: boolean
}

/**
 * Bandeau « Données à compléter » du dashboard + volet de complétion rapide :
 * toutes les infos manquantes (contacts, sociétés, revenus non rattachés,
 * dépenses récurrentes sans date) éditables au même endroit, sans ouvrir les
 * fiches une par une. Le bandeau est desktop (hidden sm:flex) ; sur mobile,
 * la carte « À traiter » de l'accueil ouvre le même volet via un événement.
 */
export function IncompleteDataSheet({
  contacts, companies, revenues, recurringExpenses,
  allCompanies, allClients, allProjects, showGraphLink,
}: Props) {
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState<Set<string>>(new Set())

  useEffect(() => {
    const handler = () => setOpen(true)
    window.addEventListener(OPEN_INCOMPLETE_SHEET_EVENT, handler)
    return () => window.removeEventListener(OPEN_INCOMPLETE_SHEET_EVENT, handler)
  }, [])

  const markDone = (id: string) => setDone((prev) => new Set(prev).add(id))
  const left = <T extends { id: string }>(items: T[]) => items.filter((i) => !done.has(i.id))

  const remContacts = left(contacts)
  const remCompanies = left(companies)
  const remRevenues = left(revenues)
  const remRecurring = left(recurringExpenses)
  const total = remContacts.length + remCompanies.length + remRevenues.length + remRecurring.length

  if (contacts.length + companies.length + revenues.length + recurringExpenses.length === 0) return null

  return (
    <>
      {/* Bandeau desktop — tout le bandeau ouvre le volet */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden sm:flex w-full items-center gap-4 flex-wrap rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-2.5 text-left transition-colors hover:border-amber-500/50"
      >
        <span className="flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 shrink-0">
          <AlertCircle className="h-3.5 w-3.5" />
          Données à compléter
        </span>
        {remContacts.length > 0 && <Counter label="Contacts" count={remContacts.length} />}
        {remCompanies.length > 0 && <Counter label="Sociétés" count={remCompanies.length} />}
        {remRevenues.length > 0 && <Counter label="Revenus" count={remRevenues.length} />}
        {remRecurring.length > 0 && <Counter label="Dépenses récurrentes" count={remRecurring.length} />}
        <span className="ml-auto text-xs text-amber-700 dark:text-amber-400 shrink-0">
          Compléter →
        </span>
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:w-[440px] sm:max-w-[440px] p-0">
          <SheetHeader className="px-5 pt-5 pb-3 border-b border-border/50">
            <SheetTitle className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              Données à compléter ({total})
            </SheetTitle>
            {showGraphLink && (
              <Link href="/graph" className="text-xs text-muted-foreground hover:text-foreground hover:underline">
                Voir dans le graphe →
              </Link>
            )}
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {total === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">Tout est complet ✓</p>
            )}

            {remContacts.length > 0 && (
              <Section title={`Contacts (${remContacts.length})`}>
                {remContacts.map((c) => (
                  <ContactRow key={c.id} contact={c} onDone={() => markDone(c.id)} />
                ))}
              </Section>
            )}

            {remCompanies.length > 0 && (
              <Section title={`Sociétés — site web manquant (${remCompanies.length})`}>
                {remCompanies.map((co) => (
                  <CompanyRow key={co.id} company={co} onDone={() => markDone(co.id)} />
                ))}
              </Section>
            )}

            {remRevenues.length > 0 && (
              <Section title={`Revenus non rattachés (${remRevenues.length})`}>
                {remRevenues.map((r) => (
                  <RevenueRow
                    key={r.id}
                    revenue={r}
                    companies={allCompanies}
                    clients={allClients}
                    projects={allProjects}
                    onDone={() => markDone(r.id)}
                  />
                ))}
              </Section>
            )}

            {remRecurring.length > 0 && (
              <Section title={`Dépenses récurrentes — date à confirmer (${remRecurring.length})`}>
                {remRecurring.map((r) => (
                  <RecurringRow key={r.id} expense={r} onDone={() => markDone(r.id)} />
                ))}
              </Section>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

function Counter({ label, count }: { label: string; count: number }) {
  return (
    <span className="flex items-center gap-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums text-amber-600">{count}</span>
    </span>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      {children}
    </section>
  )
}

const inputCls =
  "w-full h-8 rounded-md border border-input bg-background px-2 text-xs placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring"
const saveCls =
  "w-full flex items-center justify-center gap-1.5 rounded-md bg-amber-600 text-white text-xs font-medium py-1.5 hover:bg-amber-700 disabled:opacity-50 transition-colors"

// ── Société : renseigner le site web ────────────────────────────────────────

function CompanyRow({ company, onDone }: { company: IncompleteCompany; onDone: () => void }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [website, setWebsite] = useState("")

  function handleSave() {
    if (!website.trim()) return
    startTransition(async () => {
      await updateCompany(company.id, { website: website.trim() })
      onDone()
      router.refresh()
    })
  }

  return (
    <div className="rounded-lg border border-border/50 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-medium min-w-0">
          <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="truncate">{company.name}</span>
        </p>
        <Link href={`/societes/${company.id}`} className="shrink-0 text-muted-foreground hover:text-foreground transition-colors" title="Ouvrir la fiche">
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
      <input
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        placeholder="https://…"
        inputMode="url"
        className={inputCls}
      />
      {website.trim() && (
        <button onClick={handleSave} disabled={isPending} className={saveCls}>
          <Check className="h-3.5 w-3.5" />
          {isPending ? "Enregistrement…" : "Enregistrer"}
        </button>
      )}
    </div>
  )
}

// ── Revenu : rattacher à une société / un contact / un projet ───────────────

function RevenueRow({
  revenue, companies, clients, projects, onDone,
}: {
  revenue: IncompleteRevenue
  companies: AssocOption[]
  clients: AssocOption[]
  projects: AssocOption[]
  onDone: () => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [companyId, setCompanyId] = useState("")
  const [clientId, setClientId] = useState("")
  const [projectId, setProjectId] = useState("")

  const hasChoice = companyId || clientId || projectId

  function handleSave() {
    if (!hasChoice) return
    startTransition(async () => {
      await updateRevenue(revenue.id, {
        ...(companyId ? { companyId } : {}),
        ...(clientId ? { clientId } : {}),
        ...(projectId ? { projectId } : {}),
      })
      onDone()
      router.refresh()
    })
  }

  const selectCls =
    "w-full h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"

  return (
    <div className="rounded-lg border border-border/50 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-medium min-w-0">
          <Wallet className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="truncate">{revenue.label}</span>
        </p>
        <span className="shrink-0 text-xs font-semibold tabular-nums">
          {revenue.amount.toLocaleString("fr-FR")} €
        </span>
      </div>
      <div className="grid grid-cols-1 gap-1.5">
        {companies.length > 0 && (
          <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} className={selectCls}>
            <option value="">Société — aucune</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        {clients.length > 0 && (
          <select value={clientId} onChange={(e) => setClientId(e.target.value)} className={selectCls}>
            <option value="">Contact — aucun</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        {projects.length > 0 && (
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={selectCls}>
            <option value="">Projet — aucun</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
      </div>
      {hasChoice && (
        <button onClick={handleSave} disabled={isPending} className={saveCls}>
          <Check className="h-3.5 w-3.5" />
          {isPending ? "Enregistrement…" : "Rattacher"}
        </button>
      )}
    </div>
  )
}

// ── Dépense récurrente : confirmer la date de prélèvement ───────────────────

function RecurringRow({ expense, onDone }: { expense: IncompleteRecurring; onDone: () => void }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [date, setDate] = useState("")

  function handleSave() {
    if (!date) return
    startTransition(async () => {
      await confirmRecurringExpenseDate(expense.id, new Date(`${date}T00:00:00`))
      onDone()
      router.refresh()
    })
  }

  return (
    <div className="rounded-lg border border-border/50 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-medium min-w-0">
          <Repeat className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="truncate">{expense.label}</span>
        </p>
        <span className="shrink-0 text-xs font-semibold tabular-nums">
          {expense.amount.toLocaleString("fr-FR")} €
        </span>
      </div>
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className={inputCls}
        aria-label="Date de prélèvement"
      />
      {date && (
        <button onClick={handleSave} disabled={isPending} className={saveCls}>
          <Check className="h-3.5 w-3.5" />
          {isPending ? "Enregistrement…" : "Confirmer la date"}
        </button>
      )}
    </div>
  )
}
