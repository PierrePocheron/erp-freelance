"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Loader2, FilePlus2 } from "lucide-react"
import { updateInvoiceConditions } from "@/actions/facturation"
import { toast } from "sonner"

type Template = { id: string; name: string; content: string }

export function InvoiceConditionsForm({
  invoiceId,
  userId,
  defaultValue,
  templates,
}: {
  invoiceId: string
  userId: string
  defaultValue: string
  templates: Template[]
}) {
  const [value, setValue] = useState(defaultValue)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function insertTemplate(id: string) {
    const tpl = templates.find((t) => t.id === id)
    if (!tpl) return
    setValue((prev) => (prev.trim() ? `${prev.trimEnd()}\n\n${tpl.content}` : tpl.content))
  }

  function save() {
    startTransition(async () => {
      try {
        await updateInvoiceConditions(invoiceId, userId, value.trim() || null)
        toast.success("Conditions enregistrées")
        router.refresh()
      } catch {
        toast.error("Erreur lors de l'enregistrement")
      }
    })
  }

  return (
    <div className="space-y-3">
      {templates.length > 0 && (
        <div className="flex items-center gap-2">
          <FilePlus2 className="h-3.5 w-3.5 text-muted-foreground" />
          <select
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) {
                insertTemplate(e.target.value)
                e.target.value = ""
              }
            }}
            className="h-8 rounded-md border border-input bg-transparent px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="" disabled>Insérer une clause…</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      )}
      <textarea
        rows={6}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Ex : Abonnement & Reconduction — l'hébergement est reconduit tacitement chaque année…"
        className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
      />
      <Button type="button" size="sm" variant="outline" onClick={save} disabled={isPending}>
        {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        Enregistrer les conditions
      </Button>
    </div>
  )
}
