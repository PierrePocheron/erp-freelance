import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { addInteraction } from "@/actions/crm"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { InteractionsList } from "@/components/modules/crm/InteractionsList"
import { Mail, Phone, Users, MessageSquare, Coffee, MoreHorizontal } from "lucide-react"

const channels = [
  { value: "EMAIL", label: "Email", icon: Mail },
  { value: "CALL", label: "Appel", icon: Phone },
  { value: "LINKEDIN", label: "LinkedIn", icon: Users },
  { value: "MEETING", label: "Réunion", icon: Coffee },
  { value: "SMS", label: "SMS", icon: MessageSquare },
  { value: "OTHER", label: "Autre", icon: MoreHorizontal },
]

export default async function ClientInteractionsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await auth()

  const client = await prisma.client.findFirst({
    where: { id, userId: session!.user.id },
    include: {
      interactions: { orderBy: { date: "desc" } },
    },
  })

  if (!client) notFound()

  const today = new Date().toISOString().split("T")[0]

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Formulaire ajout */}
      <div className="lg:col-span-1">
        <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4 sticky top-6">
          <h2 className="font-semibold">Nouvelle interaction</h2>
          <form
            action={async (fd: FormData) => {
              "use server"
              await addInteraction(id, {
                date: fd.get("date") as string,
                channel: fd.get("channel") as string,
                summary: fd.get("summary") as string,
                response: (fd.get("response") as string) || undefined,
                emailUrl: (fd.get("emailUrl") as string) || null,
              })
            }}
            className="space-y-3"
          >
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Date</label>
              <Input name="date" type="date" defaultValue={today} required className="h-8" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Canal</label>
              <select
                name="channel"
                className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {channels.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Résumé *</label>
              <textarea
                name="summary"
                rows={3}
                required
                placeholder="Sujet de l'échange..."
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Réponse / Suite</label>
              <textarea
                name="response"
                rows={2}
                placeholder="Action prévue, réponse attendue..."
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Lien vers le mail (optionnel)</label>
              <Input
                name="emailUrl"
                type="url"
                placeholder="https://mail.google.com/mail/u/0/#inbox/..."
                className="h-8"
              />
              <p className="text-[11px] text-muted-foreground/70">
                Dans Gmail : ouvrir le mail puis copier l&apos;URL de la barre d&apos;adresse.
              </p>
            </div>
            <Button type="submit" size="sm" className="w-full">Ajouter</Button>
          </form>
        </div>
      </div>

      {/* Timeline */}
      <div className="lg:col-span-2">
        <InteractionsList clientId={id} interactions={client.interactions} />
      </div>
    </div>
  )
}
