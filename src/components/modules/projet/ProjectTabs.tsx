"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const BASE_TABS = [
  { label: "Aperçu",    suffix: "" },
  { label: "Temps",     suffix: "/temps" },
]

const DEV_TABS = [
  { label: "Dev",       suffix: "/dev" },
  { label: "Post-Dev",  suffix: "/post-dev" },
]

export function ProjectTabs({
  projectId,
  hasDevTag = false,
}: {
  projectId: string
  hasDevTag?: boolean
}) {
  const pathname = usePathname()
  const base = `/projets/${projectId}`

  const tabs = hasDevTag
    ? [BASE_TABS[0], ...DEV_TABS, BASE_TABS[1]]
    : BASE_TABS

  return (
    <div className="flex gap-1 border-b border-border overflow-x-auto [&>a]:shrink-0 [&>a]:whitespace-nowrap">
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
