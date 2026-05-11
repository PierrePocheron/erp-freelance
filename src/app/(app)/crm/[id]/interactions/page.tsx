import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { addInteraction, deleteInteraction } from "@/actions/crm"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Trash2, Mail, Phone, Users, MessageSquare, Coffee, MoreHorizontal } from "lucide-react"

const channels = [
  { value: "EMAIL", label: "Email", icon: Mail },
  { value: "CALL", label: "Appel", icon: Phone },
  { value: "LINKEDIN", label: "LinkedIn", icon: Users },
  { value: "MEETING", label: "Réunion", icon: Coffee },
  { value: "SMS", label: "SMS", icon: MessageSquare },
  { value: "OTHER", label: "Autre", icon: MoreHorizontal },
]

const channelMap = Object.fromEntries(channels.map((c) => [c.value, c]))

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
            <Button type="submit" size="sm" className="w-full">Ajouter</Button>
          </form>
        </div>
      </div>

      {/* Timeline */}
      <div className="lg:col-span-2">
        {client.interactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
            <MessageSquare className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Aucune interaction enregistrée</p>
          </div>
        ) : (
          <div className="space-y-3">
            {client.interactions.map((interaction) => {
              const ch = channelMap[interaction.channel]
              const Icon = ch?.icon ?? MoreHorizontal
              return (
                <div key={interaction.id} className="group rounded-xl border border-border/50 bg-card p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      </span>
                      <span className="text-sm font-medium">{ch?.label ?? interaction.channel}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(interaction.date).toLocaleDateString("fr-FR", {
                          weekday: "short", day: "numeric", month: "long", year: "numeric",
                        })}
                      </span>
                    </div>
                    <form action={async () => { "use server"; await deleteInteraction(interaction.id, id) }}>
                      <button type="submit" className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </form>
                  </div>
                  <p className="text-sm pl-9">{interaction.summary}</p>
                  {interaction.response && (
                    <div className="pl-9 text-xs text-muted-foreground border-l-2 border-border ml-9 pl-2">
                      <span className="font-medium">Suite : </span>{interaction.response}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
