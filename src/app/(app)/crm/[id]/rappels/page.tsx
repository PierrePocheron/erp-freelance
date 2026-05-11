import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { addReminder, toggleReminder, deleteReminder } from "@/actions/crm"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Bell, CheckCircle2, Circle, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"

export default async function ClientRappelsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await auth()

  const client = await prisma.client.findFirst({
    where: { id, userId: session!.user.id },
    include: {
      reminders: { orderBy: [{ isDone: "asc" }, { dueDate: "asc" }] },
    },
  })

  if (!client) notFound()

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const defaultDate = tomorrow.toISOString().split("T")[0]

  const pending = client.reminders.filter((r) => !r.isDone)
  const done = client.reminders.filter((r) => r.isDone)

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Formulaire */}
      <div className="lg:col-span-1">
        <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4 sticky top-6">
          <h2 className="font-semibold">Nouveau rappel</h2>
          <form
            action={async (fd: FormData) => {
              "use server"
              await addReminder(id, {
                dueDate: fd.get("dueDate") as string,
                note: (fd.get("note") as string) || undefined,
              })
            }}
            className="space-y-3"
          >
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Date *</label>
              <Input name="dueDate" type="date" defaultValue={defaultDate} required className="h-8" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Note</label>
              <Input name="note" placeholder="Relancer pour le devis..." className="h-8" />
            </div>
            <Button type="submit" size="sm" className="w-full">Ajouter</Button>
          </form>
        </div>
      </div>

      {/* Liste */}
      <div className="lg:col-span-2 space-y-6">
        {client.reminders.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
            <Bell className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Aucun rappel configuré</p>
          </div>
        ) : (
          <>
            {pending.length > 0 && (
              <section className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">À faire</p>
                {pending.map((r) => {
                  const isLate = new Date(r.dueDate) < new Date()
                  return (
                    <div key={r.id} className={cn("group flex items-center gap-3 rounded-xl border p-4 transition-all", isLate ? "border-red-500/30 bg-red-500/5" : "border-border/50 bg-card")}>
                      <form action={async () => { "use server"; await toggleReminder(r.id, id, true) }}>
                        <button type="submit" className="text-muted-foreground hover:text-emerald-500 transition-colors shrink-0">
                          <Circle className="h-4 w-4" />
                        </button>
                      </form>
                      <div className="flex-1">
                        <p className={cn("text-sm font-medium", isLate && "text-red-500")}>
                          {new Date(r.dueDate).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
                          {isLate && " — En retard"}
                        </p>
                        {r.note && <p className="text-xs text-muted-foreground">{r.note}</p>}
                      </div>
                      <form action={async () => { "use server"; await deleteReminder(r.id, id) }}>
                        <button type="submit" className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </form>
                    </div>
                  )
                })}
              </section>
            )}

            {done.length > 0 && (
              <section className="space-y-2 opacity-60">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Effectués</p>
                {done.map((r) => (
                  <div key={r.id} className="group flex items-center gap-3 rounded-xl border border-border/50 bg-card p-4">
                    <form action={async () => { "use server"; await toggleReminder(r.id, id, false) }}>
                      <button type="submit" className="text-emerald-500 hover:text-muted-foreground transition-colors shrink-0">
                        <CheckCircle2 className="h-4 w-4" />
                      </button>
                    </form>
                    <div className="flex-1">
                      <p className="text-sm line-through text-muted-foreground">
                        {new Date(r.dueDate).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}
                      </p>
                      {r.note && <p className="text-xs text-muted-foreground">{r.note}</p>}
                    </div>
                    <form action={async () => { "use server"; await deleteReminder(r.id, id) }}>
                      <button type="submit" className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </form>
                  </div>
                ))}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}
