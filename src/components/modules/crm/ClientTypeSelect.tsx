"use client"

import { useTransition } from "react"
import { updateClientType } from "@/actions/crm"

const types = [
  { value: "PROSPECT", label: "Prospect", className: "bg-amber-500/15 text-amber-600 border-amber-500/20" },
  { value: "CLIENT", label: "Client", className: "bg-emerald-500/15 text-emerald-600 border-emerald-500/20" },
  { value: "PERSONAL", label: "Perso", className: "bg-violet-500/15 text-violet-600 border-violet-500/20" },
  { value: "INACTIVE", label: "Inactif", className: "bg-muted text-muted-foreground border-border" },
]

export function ClientTypeSelect({
  clientId,
  userId,
  value,
}: {
  clientId: string
  userId: string
  value: string
}) {
  const [, startTransition] = useTransition()
  const current = types.find((t) => t.value === value) ?? types[0]

  return (
    <select
      value={value}
      onChange={(e) =>
        startTransition(() => updateClientType(clientId, userId, e.target.value))
      }
      className={`rounded-full border px-2.5 py-0.5 text-xs font-medium cursor-pointer focus:outline-none ${current.className}`}
    >
      {types.map((t) => (
        <option key={t.value} value={t.value}>
          {t.label}
        </option>
      ))}
    </select>
  )
}
