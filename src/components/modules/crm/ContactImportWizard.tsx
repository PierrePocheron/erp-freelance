"use client"

import { useMemo, useRef, useState, useSyncExternalStore } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Smartphone, FileUp, Loader2, Check, X, ChevronDown, Search, UserPlus, ArrowRight, Mail, Phone, Settings } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  previewVcfImport, previewPickedImport, previewGoogleEnrichment, rematchProposal, applyContactImport,
  type ImportDecision,
} from "@/actions/contact-import"
import type { Proposal, Confidence, Change, ImportSource } from "@/lib/contact-import"

type Stage = "source" | "loading" | "review" | "done"
type ContactLite = { id: string; name: string; company: string | null }
type PickerItem = { name?: string[]; email?: string[]; tel?: string[] }
type ContactsManagerLike = { select(props: string[], opts: { multiple: boolean }): Promise<PickerItem[]>; getProperties(): Promise<string[]> }

const CONF: Record<Confidence, { label: string; cls: string }> = {
  SURE:     { label: "Sûr",        cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
  LIKELY:   { label: "Probable",   cls: "bg-blue-500/10 text-blue-600 border-blue-500/30" },
  DOUBTFUL: { label: "À vérifier", cls: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
}
const FIELD_LABEL: Record<Change["field"], string> = { email: "Email", personalEmail: "Email perso", phone: "Téléphone", firstName: "Prénom", lastName: "Nom" }
const SOURCE_LABEL: Record<ImportSource, string> = { vcf: "Fichier .vcf", picker: "Téléphone", google: "Google Contacts", "google-other": "Gmail (autres contacts)" }

const AVATAR_COLORS = ["#6366f1", "#8b5cf6", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#14b8a6", "#f97316", "#64748b"]
function avatarColor(name: string) { let h = 0; for (const ch of name.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) | 0; return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length] }
function initials(name: string) { const p = name.trim().split(/\s+/).filter(Boolean); return ((p.length >= 2 ? p[0][0] + p[1][0] : name.slice(0, 2)) || "?").toUpperCase() }

/**
 * Assistant d'import de contacts : (1) source — sélecteur natif du téléphone (Android Chrome),
 * fichier .vcf (iPhone « Partager le contact », exports Google/Apple), ou Google Contacts ;
 * (2) validation — chaque rapprochement et chaque champ se coche/décoche, un contact inconnu
 * se crée seulement si on le demande ; (3) application. Mobile-first.
 */
export function ContactImportWizard({ hasGoogleScope, allContacts }: { hasGoogleScope: boolean; allContacts: ContactLite[] }) {
  const router = useRouter()
  const [stage, setStage] = useState<Stage>("source")
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [scanned, setScanned] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ updated: number; created: number } | null>(null)
  const [rematchFor, setRematchFor] = useState<string | null>(null)
  const [q, setQ] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)

  // Détection côté client uniquement, sans effet ni mismatch d'hydratation (snapshot serveur = false).
  // Samsung Internet expose l'API sans qu'elle fonctionne → try/catch en plus à l'ouverture.
  const pickerSupported = useSyncExternalStore(
    () => () => {},
    () => "contacts" in navigator && "ContactsManager" in window,
    () => false,
  )

  async function run(fn: () => Promise<Proposal[] | { proposals: Proposal[]; scanned: number }>) {
    setStage("loading"); setScanned(null)
    try {
      const res = await fn()
      const list = Array.isArray(res) ? res : res.proposals
      if (!Array.isArray(res)) setScanned(res.scanned)
      setProposals(list); setStage("review")
      if (list.length === 0) toast.info("Rien à rapprocher : tout est déjà à jour.")
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur"
      if (msg === "NO_SCOPE") toast.error("Accès Google Contacts non autorisé — active-le dans Réglages › Intégrations.")
      else toast.error(msg)
      setStage("source")
    }
  }

  async function pickFromPhone() {
    const nav = navigator as Navigator & { contacts?: ContactsManagerLike }
    try {
      const props = (await nav.contacts!.getProperties()).filter((p) => ["name", "email", "tel"].includes(p))
      const items = await nav.contacts!.select(props, { multiple: true })
      if (!items?.length) return
      await run(() => previewPickedImport(items))
    } catch {
      toast.error("Le sélecteur de contacts n'a pas pu s'ouvrir sur cet appareil — passe par un fichier .vcf.")
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; e.target.value = ""
    if (!f) return
    const text = await f.text()
    await run(() => previewVcfImport(text))
  }

  // ── Édition locale des propositions ──
  const update = (id: string, fn: (p: Proposal) => Proposal) => setProposals((ps) => ps.map((p) => (p.id === id ? fn(p) : p)))
  const toggleChange = (id: string, i: number) => update(id, (p) => ({ ...p, changes: p.changes.map((c, j) => (j === i ? { ...c, checked: !c.checked } : c)) }))
  const toggleCreate = (id: string) => update(id, (p) => ({ ...p, createChecked: !p.createChecked }))
  const ignore = (id: string) => setProposals((ps) => ps.filter((p) => p.id !== id))
  async function doRematch(p: Proposal, clientId: string) {
    setRematchFor(null); setQ("")
    try {
      const r = await rematchProposal(p.imported, clientId)
      update(p.id, (x) => ({ ...x, match: r.match, changes: r.changes, createChecked: false }))
    } catch { toast.error("Rapprochement impossible") }
  }
  const candidates = useMemo(() => {
    const s = q.trim().toLowerCase()
    return (s ? allContacts.filter((c) => c.name.toLowerCase().includes(s) || (c.company ?? "").toLowerCase().includes(s)) : allContacts).slice(0, 30)
  }, [q, allContacts])

  const nbChanges = proposals.reduce((n, p) => n + (p.match ? p.changes.filter((c) => c.checked).length : 0), 0)
  const nbCreate  = proposals.filter((p) => !p.match && p.createChecked).length

  async function apply() {
    const decisions: ImportDecision[] = []
    for (const p of proposals) {
      if (p.match) {
        const changes = p.changes.filter((c) => c.checked).map((c) => ({ field: c.field, to: c.to }))
        if (changes.length) decisions.push({ clientId: p.match.clientId, changes })
      } else if (p.createChecked) {
        const im = p.imported
        decisions.push({ clientId: null, changes: [], create: { firstName: im.firstName, lastName: im.lastName, name: im.name, email: im.emails[0], phone: im.phones[0], company: im.company, source: im.source } })
      }
    }
    if (!decisions.length) return
    setBusy(true)
    try {
      const r = await applyContactImport(decisions)
      setResult(r); setStage("done")
      toast.success(`${r.updated} contact${r.updated > 1 ? "s" : ""} enrichi${r.updated > 1 ? "s" : ""}${r.created ? ` · ${r.created} créé${r.created > 1 ? "s" : ""}` : ""}`)
      router.refresh()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur à l'application") }
    finally { setBusy(false) }
  }

  // ── Rendu ──
  if (stage === "loading") {
    return <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-card p-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Analyse et rapprochement des contacts…</div>
  }

  if (stage === "done" && result) {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-6 space-y-3">
        <div className="flex items-center gap-2 text-emerald-600 font-medium"><Check className="h-5 w-5" /> Import appliqué</div>
        <p className="text-sm text-muted-foreground">{result.updated} contact{result.updated > 1 ? "s" : ""} enrichi{result.updated > 1 ? "s" : ""}{result.created ? `, ${result.created} contact${result.created > 1 ? "s" : ""} créé${result.created > 1 ? "s" : ""} (type « À compléter »)` : ""}.</p>
        <div className="flex flex-wrap gap-2">
          <Link href="/contacts" className="inline-flex h-9 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90">Voir les contacts</Link>
          <button type="button" onClick={() => { setStage("source"); setProposals([]); setResult(null) }} className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-sm hover:bg-muted">Nouvel import</button>
        </div>
      </div>
    )
  }

  if (stage === "review") {
    return (
      <div className="space-y-4 pb-24">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <p className="text-muted-foreground">
            {scanned !== null && <>{scanned} contact{scanned > 1 ? "s" : ""} Google analysé{scanned > 1 ? "s" : ""} · </>}
            <span className="font-medium text-foreground">{proposals.length}</span> proposition{proposals.length > 1 ? "s" : ""} — coche ce que tu valides.
          </p>
          <button type="button" onClick={() => { setStage("source"); setProposals([]) }} className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline">Changer de source</button>
        </div>

        {proposals.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Rien à rapprocher — tout est déjà à jour.</div>
        )}

        <ul className="space-y-3">
          {proposals.map((p) => (
            <li key={p.id} className={cn("rounded-xl border bg-card p-4 space-y-3", p.match ? "border-border/50" : "border-dashed border-border")}>
              {/* Contact importé */}
              <div className="flex items-start gap-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white" style={{ backgroundColor: avatarColor(p.imported.name) }}>{initials(p.imported.name)}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <p className="font-medium truncate">{p.imported.name}</p>
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{SOURCE_LABEL[p.imported.source]}</span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    {p.imported.company && <span>{p.imported.company}</span>}
                    {p.imported.emails.map((e) => <span key={e} className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{e}</span>)}
                    {p.imported.phones.map((t) => <span key={t} className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{t}</span>)}
                  </div>
                </div>
                <button type="button" onClick={() => ignore(p.id)} aria-label="Ignorer ce contact" title="Ignorer" className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"><X className="h-4 w-4" /></button>
              </div>

              {/* Rapprochement */}
              <div className="rounded-lg bg-muted/30 p-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  {p.match ? (
                    <>
                      <Link href={`/contacts/${p.match.clientId}`} className="font-medium hover:text-primary">{p.match.name}</Link>
                      <span className={cn("rounded-full border px-1.5 py-0.5 text-[10px] font-medium", CONF[p.match.confidence].cls)}>{CONF[p.match.confidence].label}</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">Aucun contact correspondant dans l&apos;ERP</span>
                  )}
                  <div className="relative ml-auto">
                    <button type="button" onClick={() => { setRematchFor(rematchFor === p.id ? null : p.id); setQ("") }} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
                      {p.match ? "Autre contact" : "Associer à un contact"} <ChevronDown className="h-3 w-3" />
                    </button>
                    {rematchFor === p.id && (
                      <div className="absolute right-0 z-20 mt-1 w-72 max-w-[85vw] rounded-xl border border-border bg-popover p-2 shadow-xl">
                        <div className="relative mb-1">
                          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher un contact…" className="h-8 w-full rounded-md border border-input bg-transparent pl-7 pr-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
                        </div>
                        <ul className="max-h-56 overflow-y-auto">
                          {p.candidates.length > 0 && !q && <li className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">Suggestions</li>}
                          {!q && p.candidates.map((c) => (
                            <li key={c.clientId}><button type="button" onClick={() => doRematch(p, c.clientId)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"><span className="flex-1 truncate">{c.name}</span><span className={cn("rounded-full border px-1.5 text-[10px]", CONF[c.confidence].cls)}>{CONF[c.confidence].label}</span></button></li>
                          ))}
                          {candidates.map((c) => (
                            <li key={c.id}><button type="button" onClick={() => doRematch(p, c.id)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"><span className="truncate">{c.name}</span>{c.company && <span className="truncate text-xs text-muted-foreground">— {c.company}</span>}</button></li>
                          ))}
                          {candidates.length === 0 && <li className="px-2 py-2 text-sm text-muted-foreground">Aucun contact</li>}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                {/* Champs proposés */}
                {p.match && p.changes.length === 0 && <p className="text-xs text-muted-foreground pl-6">Rien à ajouter — déjà à jour.</p>}
                {p.match && p.changes.length > 0 && (
                  <ul className="space-y-1 pl-6">
                    {p.changes.map((c, i) => (
                      <li key={i}>
                        <label className="flex cursor-pointer items-start gap-2 text-sm">
                          <input type="checkbox" checked={c.checked} onChange={() => toggleChange(p.id, i)} className="mt-1 h-4 w-4 rounded border-input accent-primary" />
                          <span className="min-w-0">
                            <span className="text-muted-foreground">{FIELD_LABEL[c.field]} : </span>
                            {c.kind === "replace" && <span className="line-through text-muted-foreground/70 break-all">{c.from}</span>}
                            {c.kind === "replace" && " → "}
                            <span className="font-medium break-all">{c.to}</span>
                            {c.kind === "replace" && <span className="ml-1 rounded bg-amber-500/10 px-1 text-[10px] text-amber-600">remplacer</span>}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
                {!p.match && (
                  <label className="flex cursor-pointer items-center gap-2 pl-6 text-sm">
                    <input type="checkbox" checked={p.createChecked} onChange={() => toggleCreate(p.id)} className="h-4 w-4 rounded border-input accent-primary" />
                    <UserPlus className="h-3.5 w-3.5 text-muted-foreground" /> Créer ce contact <span className="text-xs text-muted-foreground">(type « À compléter »)</span>
                  </label>
                )}
              </div>
            </li>
          ))}
        </ul>

        {/* Barre d'action collante */}
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 p-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {nbChanges} modification{nbChanges > 1 ? "s" : ""}{nbCreate ? ` · ${nbCreate} création${nbCreate > 1 ? "s" : ""}` : ""} à appliquer
            </p>
            <button type="button" onClick={apply} disabled={busy || (nbChanges + nbCreate === 0)} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Appliquer
            </button>
          </div>
        </div>
      </div>
    )
  }

  // stage === "source"
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {/* Téléphone : sélecteur natif si dispo (Android Chrome), sinon .vcf */}
      <button type="button" onClick={pickerSupported ? pickFromPhone : () => fileRef.current?.click()} className="rounded-xl border border-border/50 bg-card p-5 text-left transition-colors hover:border-primary/40 hover:bg-muted/30">
        <Smartphone className="h-6 w-6 text-primary" />
        <p className="mt-3 font-medium">Depuis le téléphone</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {pickerSupported
            ? "Sélectionne des contacts dans le carnet de ton téléphone."
            : "Sur iPhone : Contacts → Partager le contact → enregistre le fichier .vcf, puis choisis-le ici."}
        </p>
      </button>

      <button type="button" onClick={() => fileRef.current?.click()} className="rounded-xl border border-border/50 bg-card p-5 text-left transition-colors hover:border-primary/40 hover:bg-muted/30">
        <FileUp className="h-6 w-6 text-primary" />
        <p className="mt-3 font-medium">Fichier .vcf</p>
        <p className="mt-1 text-xs text-muted-foreground">Export de Contacts (iPhone/Mac), Google Contacts ou Outlook — un ou plusieurs contacts.</p>
      </button>
      <input ref={fileRef} type="file" accept=".vcf,text/vcard,text/x-vcard" onChange={onFile} className="hidden" aria-label="Choisir un fichier .vcf" />

      <div className="rounded-xl border border-border/50 bg-card p-5 space-y-3">
        <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
        <div>
          <p className="font-medium">Google Contacts</p>
          <p className="mt-1 text-xs text-muted-foreground">Compare tes contacts ERP avec ton carnet Google et les adresses mémorisées par Gmail ; propose les emails et téléphones manquants.</p>
        </div>
        {hasGoogleScope ? (
          <button type="button" onClick={() => run(previewGoogleEnrichment)} className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Search className="h-4 w-4" /> Analyser mes contacts Google
          </button>
        ) : (
          <Link href="/settings" className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted">
            <Settings className="h-4 w-4" /> Autoriser dans Réglages
          </Link>
        )}
      </div>
    </div>
  )
}
