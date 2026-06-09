"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/actions/crm"
import { CompanyCombobox } from "./CompanyCombobox"

export function CreateClientDialog({
  userId,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: {
  userId: string
  open?: boolean
  onOpenChange?: (v: boolean) => void
}) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [company, setCompany] = useState<{ id: string | null; name: string }>({ id: null, name: "" })
  const router = useRouter()
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen! : internalOpen

  function handleOpenChange(v: boolean) {
    if (!isControlled) setInternalOpen(v)
    if (!v) setCompany({ id: null, name: "" })
    controlledOnOpenChange?.(v)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const client = await createClient(userId, {
        label: (fd.get("label") as string) || undefined,
        firstName: (fd.get("firstName") as string) || undefined,
        lastName: (fd.get("lastName") as string) || undefined,
        companyId: company.id || undefined,
        companyName: company.name.trim() || undefined,
        email: (fd.get("email") as string) || undefined,
        phone: (fd.get("phone") as string) || undefined,
        type: (fd.get("type") as string) || undefined,
        source: (fd.get("source") as string) || undefined,
        temperature: (fd.get("temperature") as string) || undefined,
        notes: (fd.get("notes") as string) || undefined,
        address: (fd.get("address") as string) || undefined,
        postalCode: (fd.get("postalCode") as string) || undefined,
        city: (fd.get("city") as string) || undefined,
        country: (fd.get("country") as string) || undefined,
        siret: (fd.get("siret") as string) || undefined,
      })
      handleOpenChange(false)
      router.push(`/client/${client.id}`)
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {!isControlled && (
        <DialogTrigger className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors">
          <Plus className="h-4 w-4" />
          Nouveau contact
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-2xl flex flex-col p-0 gap-0 max-h-[90vh]">
        <div className="px-4 pt-4 pb-2 shrink-0">
          <DialogHeader>
            <DialogTitle>Nouveau contact</DialogTitle>
          </DialogHeader>
        </div>

        <form id="create-contact-form" onSubmit={handleSubmit} autoComplete="off" className="contents">
          <div className="overflow-y-auto flex-1 px-4 pb-2">
            <div className="space-y-5 pt-1">
              {/* ── Identité ── */}
              <section className="space-y-3">
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">Identité</h3>
                <div className="space-y-1.5">
                  <Label>Libellé du contact</Label>
                  <Input name="label" placeholder="Optionnel — nom affiché si renseigné" autoComplete="off" />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Prénom</Label>
                    <Input name="firstName" placeholder="Jean" autoComplete="off" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Nom</Label>
                    <Input name="lastName" placeholder="Dupont" autoComplete="off" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Société</Label>
                  <CompanyCombobox value={company} onChange={setCompany} />
                </div>
              </section>

              {/* ── Coordonnées ── */}
              <section className="space-y-3">
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">Coordonnées</h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Email</Label>
                    <Input name="email" type="email" placeholder="jean@acme.fr" autoComplete="off" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Téléphone</Label>
                    <Input name="phone" placeholder="+33 6 00 00 00 00" autoComplete="off" />
                  </div>
                </div>
              </section>

              {/* ── Qualification ── */}
              <section className="space-y-3">
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">Qualification</h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label>Type</Label>
                    <select name="type" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                      <option value="TO_COMPLETE">À compléter</option>
                      <option value="PROSPECT">Prospect</option>
                      <option value="CLIENT">Client</option>
                      <option value="PERSONAL">Perso</option>
                      <option value="INACTIVE">Inactif</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Source</Label>
                    <select name="source" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                      <option value="OTHER">Autre</option>
                      <option value="WORD_OF_MOUTH">Bouche à oreille</option>
                      <option value="LINKEDIN">LinkedIn</option>
                      <option value="WEBSITE">Site web</option>
                      <option value="INBOUND">Entrant</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Température</Label>
                    <select name="temperature" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                      <option value="COLD">Froid</option>
                      <option value="WARM">Tiède</option>
                      <option value="HOT">Chaud</option>
                    </select>
                  </div>
                </div>
              </section>

              {/* ── Adresse du contact (optionnelle) ── */}
              <section className="space-y-3">
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">
                  Adresse du contact <span className="font-normal normal-case text-muted-foreground/60">(optionnelle)</span>
                </h3>
                <div className="space-y-1.5">
                  <Label>Adresse</Label>
                  <Input name="address" placeholder="12 rue de la Paix" autoComplete="off" />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label>Code postal</Label>
                    <Input name="postalCode" placeholder="75001" autoComplete="off" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Ville</Label>
                    <Input name="city" placeholder="Paris" autoComplete="off" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Pays</Label>
                    <Input name="country" placeholder="France" autoComplete="off" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>SIRET</Label>
                  <Input name="siret" placeholder="123 456 789 00012" autoComplete="off" />
                </div>
              </section>

              {/* ── Notes ── */}
              <section className="space-y-1.5">
                <Label>Notes</Label>
                <textarea
                  name="notes"
                  rows={2}
                  placeholder="Notes internes..."
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                />
              </section>
            </div>
          </div>

          {/* ── Footer toujours visible ── */}
          <div className="flex justify-end gap-2 px-4 py-3 border-t shrink-0">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>Annuler</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Création..." : "Créer le contact"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
