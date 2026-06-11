"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const tabs = [
  { href: "/contacts",           label: "Contacts"     },
  { href: "/contacts/prospects", label: "Prospection"  },
]

export function ContactsNav() {
  const pathname = usePathname()

  return (
    <div className="flex items-center gap-1 border-b border-border/60 -mb-2">
      {tabs.map(({ href, label }) => {
        const active = href === "/contacts"
          ? pathname === "/contacts"
          : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            )}
          >
            {label}
          </Link>
        )
      })}
    </div>
  )
}
