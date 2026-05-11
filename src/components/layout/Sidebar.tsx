"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Users,
  FileText,
  Code2,
  Calendar,
  Server,
} from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/crm", icon: Users, label: "CRM" },
  { href: "/facturation", icon: FileText, label: "Facturation" },
  { href: "/projets", icon: Code2, label: "Projets" },
  { href: "/calendrier", icon: Calendar, label: "Calendrier" },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex h-screen w-16 flex-col items-center gap-4 border-r border-border/50 bg-background/80 py-6 backdrop-blur-sm">
      <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
        <Server className="h-5 w-5 text-primary-foreground" />
      </div>

      <nav className="flex flex-col items-center gap-1">
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive =
            href === "/" ? pathname === "/" : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              title={label}
              className={cn(
                "group relative flex h-10 w-10 items-center justify-center rounded-xl transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="pointer-events-none absolute left-14 z-50 hidden whitespace-nowrap rounded-md bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md group-hover:block">
                {label}
              </span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
