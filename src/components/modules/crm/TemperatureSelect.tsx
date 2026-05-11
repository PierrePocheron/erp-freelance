"use client"

import { useTransition } from "react"
import { updateClientTemperature } from "@/actions/crm"

const temps = [
  { value: "COLD", label: "Froid", color: "text-blue-500", dot: "bg-blue-500" },
  { value: "WARM", label: "Tiède", color: "text-amber-500", dot: "bg-amber-500" },
  { value: "HOT", label: "Chaud", color: "text-red-500", dot: "bg-red-500" },
]

export function TemperatureSelect({
  clientId,
  userId,
  value,
}: {
  clientId: string
  userId: string
  value: string
}) {
  const [, startTransition] = useTransition()
  const current = temps.find((t) => t.value === value) ?? temps[0]

  return (
    <div className="flex items-center gap-1.5">
      {temps.map((t) => (
        <button
          key={t.value}
          onClick={() => startTransition(() => updateClientTemperature(clientId, userId, t.value))}
          title={t.label}
          className={`h-3 w-3 rounded-full transition-all ${t.dot} ${
            value === t.value ? "ring-2 ring-offset-1 ring-foreground/30 scale-125" : "opacity-40 hover:opacity-70"
          }`}
        />
      ))}
      <span className={`text-xs font-medium ${current.color}`}>{current.label}</span>
    </div>
  )
}
