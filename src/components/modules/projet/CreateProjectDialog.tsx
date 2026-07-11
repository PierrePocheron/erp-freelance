"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, ChevronLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createProject } from "@/actions/projet"
import { createCompany } from "@/actions/crm"
import { CATEGORY_CONFIG, ALL_CATEGORIES } from "./category-config"

type Company = { id: string; name: string; city: string | null }
type Contact = { id: string; name: string; company: string | null; companyId: string | null }

export function CreateProjectDialog({
  userId,
  companies: initialCompanies,
  contacts,
  defaultCompanyId,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: {
  userId: string
  companies: Company[]
  contacts: Contact[]
  defaultCompanyId?: string
  open?: boolean
  onOpenChange?: (v: boolean) => void
}) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen! : internalOpen

  const [companies, setCompanies] = useState(initialCompanies)
  const [selectedCompanyId, setSelectedCompanyId] = useState(defaultCompanyId ?? initialCompanies[0]?.id ?? "")
  const [selectedContactId, setSelectedContactId] = useState("")
  const [showNewCompany, setShowNewCompany] = useState(false)
  const [startDate, setStartDate] = useState("")

  const [isPending, startTransition] = useTransition()
  const [isCreatingCompany, startCreatingCompany] = useTransition()
  const router = useRouter()

  function handleOpenChange(v: boolean) {
    if (!isControlled) setInternalOpen(v)
    if (!v) { setShowNewCompany(false) }
    controlledOnOpenChange?.(v)
  }

  // Contacts filtrés selon la société sélectionnée (si des contacts sont liés)
  const filteredContacts = selectedCompanyId
    ? contacts.filter((c) => c.companyId === selectedCompanyId || c.companyId === null)
    : contacts

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    if (selectedCompanyId) formData.set("companyId", selectedCompanyId)
    if (selectedContactId) formData.set("contactId", selectedContactId)
    startTransition(async () => {
      const project = await createProject(userId, formData)
      handleOpenChange(false)
      router.push(`/projets/${project.id}`)
    })
  }

  function handleCreateCompany(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startCreatingCompany(async () => {
      const created = await createCompany({
        name: (fd.get("companyName") as string).trim(),
        city: (fd.get("companyCity") as string) || undefined,
        email: (fd.get("companyEmail") as string) || undefined,
        phone: (fd.get("companyPhone") as string) || undefined,
      })
      setCompanies((prev) => [...prev, { id: created.id, name: created.name, city: created.city }])
      setSelectedCompanyId(created.id)
      setShowNewCompany(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {!isControlled && (
        <DialogTrigger className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors">
          <Plus className="h-4 w-4" />
          Nouveau projet
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md flex flex-col p-0 gap-0 max-h-[90vh]">
        <div className="px-4 pt-4 pb-2 shrink-0">
          <DialogHeader>
            <DialogTitle>
              {showNewCompany ? "Nouvelle société" : "Nouveau projet"}
            </DialogTitle>
          </DialogHeader>
        </div>

        {/* Mini-form nouvelle société */}
        {showNewCompany ? (
          <form onSubmit={handleCreateCompany} className="flex flex-col flex-1 overflow-y-auto">
            <div className="px-4 pb-4 space-y-3 flex-1">
              <button
                type="button"
                onClick={() => setShowNewCompany(false)}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                <ChevronLeft className="h-4 w-4" /> Retour
              </button>
              <div className="space-y-1.5">
                <Label htmlFor="companyName">Nom *</Label>
                <Input id="companyName" name="companyName" placeholder="Acme Corp" required autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="companyCity">Ville</Label>
                <Input id="companyCity" name="companyCity" placeholder="Paris" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="companyEmail">Email</Label>
                  <Input id="companyEmail" name="companyEmail" type="email" placeholder="contact@acme.fr" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="companyPhone">Téléphone</Label>
                  <Input id="companyPhone" name="companyPhone" placeholder="+33 1 …" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-4 py-3 border-t shrink-0">
              <Button type="button" variant="outline" onClick={() => setShowNewCompany(false)}>Annuler</Button>
              <Button type="submit" disabled={isCreatingCompany}>
                {isCreatingCompany ? "Création..." : "Créer la société"}
              </Button>
            </div>
          </form>
        ) : (
          /* Form principal création projet */
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-y-auto">
            <div className="px-4 pb-4 space-y-4 flex-1 pt-1">
              {/* Nom du projet */}
              <div className="space-y-1.5">
                <Label htmlFor="name">Nom du projet *</Label>
                <Input id="name" name="name" placeholder="Mon site e-commerce" required />
              </div>

              {/* Catégorie (thème de la bannière) */}
              <div className="space-y-1.5">
                <Label htmlFor="category">Catégorie</Label>
                <select
                  id="category"
                  name="category"
                  defaultValue="AUTRE"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {ALL_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{CATEGORY_CONFIG[c].label}</option>
                  ))}
                </select>
              </div>

              {/* Société */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>Société</Label>
                  <button
                    type="button"
                    onClick={() => setShowNewCompany(true)}
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <Plus className="h-3 w-3" />
                    Nouvelle société
                  </button>
                </div>
                <select
                  value={selectedCompanyId}
                  onChange={(e) => { setSelectedCompanyId(e.target.value); setSelectedContactId("") }}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">— Aucune société —</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}{c.city ? ` (${c.city})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Contact */}
              <div className="space-y-1.5">
                <Label>Contact</Label>
                <select
                  value={selectedContactId}
                  onChange={(e) => setSelectedContactId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">— Aucun contact —</option>
                  {filteredContacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}{c.company && c.companyId !== selectedCompanyId ? ` — ${c.company}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label htmlFor="description">Description</Label>
                <Input id="description" name="description" placeholder="Courte description..." />
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="startDate">Début</Label>
                  <Input
                    id="startDate"
                    name="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="endDate">Fin estimée</Label>
                  <Input id="endDate" name="endDate" type="date" min={startDate || undefined} />
                </div>
              </div>

              {/* Heures */}
              <div className="space-y-1.5">
                <Label htmlFor="estimatedHours">Heures estimées</Label>
                <Input id="estimatedHours" name="estimatedHours" type="number" min="0" step="0.5" placeholder="20" />
              </div>
            </div>

            <div className="flex justify-end gap-2 px-4 py-3 border-t shrink-0">
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>Annuler</Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Création..." : "Créer le projet"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
