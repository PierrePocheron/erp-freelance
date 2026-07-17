"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { AlertCircle, ExternalLink, Check } from "lucide-react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { updateClientAll } from "@/actions/crm"

export type IncompleteContact = {
  id: string
  name: string
  company: string | null
  firstName: string | null
  lastName: string | null
  email: string | null
  phone: string | null
}

// Carte statistique cliquable "Infos manquantes" — ouvre un volet listant tous
// les contacts incomplets avec complétion rapide en un seul endroit, sans avoir
// à ouvrir chaque fiche une par une.
export function IncompleteContactsSheet({ contacts }: { contacts: IncompleteContact[] }) {
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState<Set<string>>(new Set())

  const remaining = contacts.filter(c => !done.has(c.id))

  return (
    <>
      <button onClick={() => setOpen(true)} className="text-left w-full">
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-1 transition-colors hover:border-amber-500/50">
          <div className="flex items-center gap-2 text-xs text-amber-600">
            <AlertCircle className="h-4 w-4" />
            Infos manquantes
          </div>
          <p className="text-2xl font-bold text-amber-600">{contacts.length}</p>
        </div>
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:w-[420px] sm:max-w-[420px] p-0">
          <SheetHeader className="px-5 pt-5 pb-3 border-b border-border/50">
            <SheetTitle className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              Infos manquantes ({remaining.length})
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {remaining.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                Tous les contacts sont complets ✓
              </p>
            )}
            {remaining.map(c => (
              <ContactRow key={c.id} contact={c} onDone={() => setDone(prev => new Set(prev).add(c.id))} />
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

// Exportée : réutilisée par le volet global « Données à compléter » du dashboard.
export function ContactRow({ contact: c, onDone }: { contact: IncompleteContact; onDone: () => void }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName]   = useState("")
  const [email, setEmail]         = useState("")
  const [phone, setPhone]         = useState("")

  const needsName  = !c.firstName || !c.lastName
  const needsCoord = !c.email && !c.phone

  function handleSave() {
    const hasInput = firstName.trim() || lastName.trim() || email.trim() || phone.trim()
    if (!hasInput) return
    startTransition(async () => {
      await updateClientAll(c.id, {
        ...(firstName.trim() ? { firstName: firstName.trim() } : {}),
        ...(lastName.trim()  ? { lastName: lastName.trim() }   : {}),
        ...(email.trim()     ? { email: email.trim() }         : {}),
        ...(phone.trim()     ? { phone: phone.trim() }         : {}),
      })
      onDone()
      router.refresh()
    })
  }

  const hasInput = firstName.trim() || lastName.trim() || email.trim() || phone.trim()

  return (
    <div className="rounded-lg border border-border/50 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{c.name}</p>
          {c.company && <p className="text-xs text-muted-foreground truncate">{c.company}</p>}
        </div>
        <Link
          href={`/contacts/${c.id}`}
          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          title="Ouvrir la fiche"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>

      {needsName && (
        <div className="flex gap-1.5">
          <input
            value={firstName}
            onChange={e => setFirstName(e.target.value)}
            placeholder="Prénom"
            className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <input
            value={lastName}
            onChange={e => setLastName(e.target.value)}
            placeholder="Nom"
            className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      )}
      {needsCoord && (
        <div className="flex gap-1.5">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="email@exemple.com"
            className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="+33 6 …"
            className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      )}
      {hasInput && (
        <button
          onClick={handleSave}
          disabled={isPending}
          className="w-full flex items-center justify-center gap-1.5 rounded-md bg-amber-600 text-white text-xs font-medium py-1.5 hover:bg-amber-700 disabled:opacity-50 transition-colors"
        >
          <Check className="h-3.5 w-3.5" />
          {isPending ? "Enregistrement…" : "Enregistrer"}
        </button>
      )}
    </div>
  )
}
