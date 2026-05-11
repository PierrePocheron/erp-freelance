"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const tabs = [
  { label: "Aperçu", suffix: "" },
  { label: "Interactions", suffix: "/interactions" },
  { label: "Rappels", suffix: "/rappels" },
  { label: "Projets", suffix: "/projets" },
]

export function ClientTabs({ clientId }: { clientId: string }) {
  const pathname = usePathname()
  const base = `/crm/${clientId}`

  return (
    <div className="flex gap-1 border-b border-border">
      {tabs.map(({ label, suffix }) => {
        const href = base + suffix
        const isActive = suffix === "" ? pathname === base : pathname.startsWith(href)
        return (
          <Link
            key={suffix}
            href={href}
            className={cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
              isActive
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </Link>
        )
      })}
    </div>
  )
}
