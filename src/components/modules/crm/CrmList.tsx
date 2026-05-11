"use client"

import { useState, useTransition } from "react"
import { getClientPanel } from "@/actions/crm"
import { ClientPanel } from "./ClientPanel"
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet"

const tempConfig = {
  COLD: { dot: "bg-blue-500", label: "Froid" },
  WARM: { dot: "bg-amber-500", label: "Tiède" },
  HOT: { dot: "bg-red-500", label: "Chaud" },
}

const typeConfig = {
  PROSPECT: { label: "Prospect", className: "bg-amber-500/15 text-amber-600 border-amber-500/20" },
  CLIENT: { label: "Client", className: "bg-emerald-500/15 text-emerald-600 border-emerald-500/20" },
  SELF: { label: "Perso", className: "bg-indigo-500/15 text-indigo-600 border-indigo-500/20" },
  INACTIVE: { label: "Inactif", className: "bg-muted text-muted-foreground border-border" },
}

const sourceLabels: Record<string, string> = {
  WORD_OF_MOUTH: "Bouche à oreille",
  LINKEDIN: "LinkedIn",
  WEBSITE: "Site web",
  INBOUND: "Entrant",
  OTHER: "Autre",
}

type Client = {
  id: string
  name: string
  company: string | null
  email: string | null
  type: string
  temperature: string
  source: string
  _count: { interactions: number; projects: number }
  interactions: { date: Date | string; channel: string }[]
  reminders: { dueDate: Date | string }[]
}

type Group = { key: string; label: string; items: Client[] }

type PanelData = Awaited<ReturnType<typeof getClientPanel>>

export function CrmList({
  groups,
  userId,
}: {
  groups: Group[]
  userId: string
}) {
  const [open, setOpen] = useState(false)
  const [panelData, setPanelData] = useState<PanelData>(null)
  const [isPending, startTransition] = useTransition()

  function openClient(clientId: string) {
    setOpen(true)
    setPanelData(null)
    startTransition(async () => {
      const data = await getClientPanel(clientId, userId)
      setPanelData(data)
    })
  }

  const hasClients = groups.some((g) => g.items.length > 0)

  return (
    <>
      {!hasClients ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
          <p className="font-medium">Aucun contact</p>
          <p className="text-sm text-muted-foreground mt-1">Ajoutez votre premier prospect ou client</p>
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map(({ key, label, items }) =>
            items.length === 0 ? null : (
              <section key={key} className="space-y-3">
                <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{label}</h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((client) => {
                    const type = typeConfig[client.type as keyof typeof typeConfig]
                    const temp = tempConfig[client.temperature as keyof typeof tempConfig]
                    const lastInteraction = client.interactions[0]
                    const nextReminder = client.reminders[0]

                    return (
                      <button
                        key={client.id}
                        onClick={() => openClient(client.id)}
                        className="group rounded-xl border border-border/50 bg-card p-4 hover:border-border hover:shadow-md transition-all space-y-3 text-left w-full"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className={`h-2 w-2 rounded-full ${temp.dot}`} title={temp.label} />
                              <p className="text-xs text-muted-foreground">
                                {client.company ?? sourceLabels[client.source] ?? "—"}
                              </p>
                            </div>
                            <p className="font-semibold group-hover:text-primary transition-colors">{client.name}</p>
                            {client.email && <p className="text-xs text-muted-foreground truncate">{client.email}</p>}
                          </div>
                          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${type.className}`}>
                            {type.label}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {lastInteraction && (
                            <span>
                              Dernier contact{" "}
                              {new Date(lastInteraction.date).toLocaleDateString("fr-FR", {
                                day: "numeric", month: "short",
                              })}
                            </span>
                          )}
                          {nextReminder && (
                            <span className={new Date(nextReminder.dueDate) < new Date() ? "text-red-500 font-medium" : "text-amber-600"}>
                              ⏰{" "}
                              {new Date(nextReminder.dueDate).toLocaleDateString("fr-FR", {
                                day: "numeric", month: "short",
                              })}
                            </span>
                          )}
                          {client._count.projects > 0 && (
                            <span className="ml-auto">
                              {client._count.projects} projet{client._count.projects !== 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </section>
            )
          )}
        </div>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="w-[460px] sm:max-w-[460px] p-0"
          showCloseButton={true}
        >
          <ClientPanel client={panelData as any} loading={isPending || (open && panelData === null)} />
        </SheetContent>
      </Sheet>
    </>
  )
}
