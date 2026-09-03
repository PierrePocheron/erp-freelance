"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { Plus, UserPlus, X, Loader2, Mail, Phone, Building2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ClientCombobox } from "@/components/modules/facturation/ClientCombobox"

export type ContactOption = { id: string; name: string; company: string | null; email: string | null; phone: string | null; type: string }

export type ProjectContactRole = "CLIENT" | "COLLEAGUE" | "PARTNER" | "SUPPLIER" | "PERSONAL" | "OTHER"

export type ProjectContactEntry = {
  clientId: string
  role: ProjectContactRole
  label: string | null
  client: ContactOption
}

const ROLE_OPTIONS: { value: ProjectContactRole; label: string }[] = [
  { value: "CLIENT",    label: "Client"      },
  { value: "COLLEAGUE", label: "Collègue"    },
  { value: "PARTNER",   label: "Partenaire"  },
  { value: "SUPPLIER",  label: "Fournisseur" },
  { value: "PERSONAL",  label: "Perso"       },
  { value: "OTHER",     label: "Autre"       },
]
const ROLE_LABEL = Object.fromEntries(ROLE_OPTIONS.map((r) => [r.value, r.label])) as Record<ProjectContactRole, string>

// Couleur de l'anneau d'avatar (= rôle, lisible d'un coup d'œil) + badge dans la modale.
const ROLE_RING: Record<ProjectContactRole, string> = {
  CLIENT:    "ring-blue-500",
  COLLEAGUE: "ring-violet-500",
  PARTNER:   "ring-amber-500",
  SUPPLIER:  "ring-orange-500",
  PERSONAL:  "ring-pink-500",
  OTHER:     "ring-border",
}
const ROLE_BADGE: Record<ProjectContactRole, string> = {
  CLIENT:    "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  COLLEAGUE: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  PARTNER:   "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  SUPPLIER:  "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  PERSONAL:  "bg-pink-500/10 text-pink-600 dark:text-pink-400",
  OTHER:     "bg-muted text-muted-foreground",
}

// Pastille d'initiales : couleur déterministe par nom (pas de photo sur les contacts).
const AVATAR_COLORS = ["#6366f1", "#8b5cf6", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#14b8a6", "#f97316", "#64748b"]
function avatarColor(name: string): string {
  let h = 0
  for (const ch of name.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) | 0
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const s = parts.length >= 2 ? parts[0][0] + parts[1][0] : name.trim().slice(0, 2)
  return s.toUpperCase() || "?"
}

function ContactAvatar({ c, role, size = "h-8 w-8 text-xs" }: { c: ContactOption; role?: ProjectContactRole; size?: string }) {
  return (
    <span
      className={`inline-flex ${size} shrink-0 items-center justify-center rounded-full font-semibold text-white ring-2 ring-offset-2 ring-offset-background ${role ? ROLE_RING[role] : "ring-transparent"}`}
      style={{ backgroundColor: avatarColor(c.name) }}
      aria-hidden
    >
      {initials(c.name)}
    </span>
  )
}

/**
 * Contacts d'un projet, en haut à droite de la fiche : pile d'avatars (initiales colorées,
 * anneau = rôle). Survol → bulle « qui c'est » (société, rôle · précision, email, tél.) ;
 * clic → fiche contact. Le « + » ouvre une modale : combobox « chercher ou créer », rôle
 * (dont Perso), précision lisible, et la liste des contacts liés avec retrait.
 */
export function ProjectContactsStack({
  userId, allContacts, projectContacts, onAdd, onRemove,
}: {
  projectId: string
  userId: string
  allContacts: ContactOption[]
  projectContacts: ProjectContactEntry[]
  onAdd: (clientId: string, role: ProjectContactRole, label?: string) => Promise<void>
  onRemove: (clientId: string) => Promise<void>
}) {
  const [isPending, start] = useTransition()
  const [open, setOpen] = useState(false)
  const [selectedId, setSelectedId] = useState("")
  const [role, setRole] = useState<ProjectContactRole>("OTHER")
  const [label, setLabel] = useState("")

  const linkedIds = new Set(projectContacts.map((c) => c.clientId))
  const available = allContacts.filter((c) => !linkedIds.has(c.id))

  const add = () => {
    if (!selectedId) return
    start(async () => {
      await onAdd(selectedId, role, label.trim() || undefined)
      setSelectedId(""); setRole("OTHER"); setLabel("")
    })
  }
  const remove = (clientId: string) => start(() => onRemove(clientId))

  return (
    <TooltipProvider delay={150}>
      <div className="flex items-center gap-2">
        {/* Pile d'avatars — survol = bulle, clic = fiche contact */}
        {projectContacts.length > 0 && (
          <div className="flex items-center -space-x-1.5">
            {projectContacts.map((pc) => (
              <Tooltip key={pc.clientId}>
                <TooltipTrigger
                  render={<Link href={`/contacts/${pc.client.id}`} aria-label={`${pc.client.name} — ${ROLE_LABEL[pc.role]}`} className="rounded-full transition-transform hover:z-10 hover:scale-110 focus:z-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring" />}
                >
                  <ContactAvatar c={pc.client} role={pc.role} />
                </TooltipTrigger>
                <TooltipContent side="bottom" className="block max-w-[260px] space-y-1 px-3 py-2 text-left">
                  <p className="font-semibold leading-tight">{pc.client.name}</p>
                  {pc.client.company && <p className="flex items-center gap-1.5 opacity-80"><Building2 className="h-3 w-3" /> {pc.client.company}</p>}
                  <p className="opacity-80">{ROLE_LABEL[pc.role]}{pc.label ? ` · ${pc.label}` : ""}</p>
                  {pc.client.email && <p className="flex items-center gap-1.5 opacity-80 truncate"><Mail className="h-3 w-3 shrink-0" /> {pc.client.email}</p>}
                  {pc.client.phone && <p className="flex items-center gap-1.5 opacity-80"><Phone className="h-3 w-3 shrink-0" /> {pc.client.phone}</p>}
                  <p className="pt-0.5 text-[10px] opacity-60">Cliquer pour ouvrir la fiche</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        )}

        {/* Bouton explicite « Ajouter un contact » (un « + » nu ne dit pas à quoi il sert) ;
            la modale permet aussi de gérer/retirer les contacts déjà liés. */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger
            render={
              <button
                type="button"
                title="Ajouter un contact au projet (et gérer les contacts liés)"
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-dashed border-border px-3 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
              />
            }
          >
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
            Ajouter un contact
          </DialogTrigger>

          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Contacts du projet</DialogTitle>
              <DialogDescription>Qui est impliqué, et à quel titre.</DialogDescription>
            </DialogHeader>

            {/* Contacts liés */}
            {projectContacts.length > 0 && (
              <ul className="space-y-1.5">
                {projectContacts.map((pc) => (
                  <li key={pc.clientId} className="flex items-center gap-2.5 rounded-lg border border-border/50 px-2.5 py-2">
                    <ContactAvatar c={pc.client} role={pc.role} size="h-7 w-7 text-[10px]" />
                    <div className="min-w-0 flex-1">
                      <Link href={`/contacts/${pc.client.id}`} className="block truncate text-sm font-medium hover:text-primary transition-colors">{pc.client.name}</Link>
                      <p className="truncate text-xs text-muted-foreground">
                        {pc.client.company ?? ""}{pc.client.company && pc.label ? " · " : ""}{pc.label ?? ""}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${ROLE_BADGE[pc.role]}`}>{ROLE_LABEL[pc.role]}</span>
                    <button
                      type="button"
                      onClick={() => remove(pc.clientId)}
                      disabled={isPending}
                      aria-label={`Retirer ${pc.client.name}`}
                      title="Retirer du projet"
                      className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* Associer / créer */}
            <div className="space-y-2.5 border-t border-border/50 pt-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Associer un contact</p>
              <ClientCombobox
                userId={userId}
                clients={available.map((c) => ({ id: c.id, name: c.name, company: c.company, type: c.type }))}
                value={selectedId}
                onChange={setSelectedId}
              />
              <div className="flex gap-2">
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as ProjectContactRole)}
                  disabled={isPending}
                  aria-label="Rôle sur le projet"
                  className="h-9 shrink-0 rounded-md border border-input bg-transparent px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-60"
                >
                  {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add() } }}
                  placeholder="Précision (ex : chef de projet, lead dev…)"
                  aria-label="Précision (optionnel)"
                  disabled={isPending}
                  className="h-9 min-w-0 flex-1 rounded-md border border-input bg-transparent px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-60"
                />
              </div>
              <button
                type="button"
                onClick={add}
                disabled={!selectedId || isPending}
                className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Associer au projet
              </button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}
