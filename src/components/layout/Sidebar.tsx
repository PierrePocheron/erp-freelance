"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import {
  LayoutDashboard,
  Users,
  FileText,
  Code2,
  Calendar,
  Server,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ThemeToggle } from "./ThemeToggle"

const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/crm", icon: Users, label: "CRM" },
  { href: "/facturation", icon: FileText, label: "Facturation" },
  { href: "/projets", icon: Code2, label: "Projets" },
  { href: "/calendrier", icon: Calendar, label: "Calendrier" },
  { href: "/settings", icon: Settings, label: "Paramètres" },
]

const STORAGE_KEY = "erp-sidebar-expanded"

export function Sidebar() {
  const pathname = usePathname()
  const [expanded, setExpanded] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored !== null) setExpanded(stored === "true")
    setMounted(true)
  }, [])

  function toggle() {
    setExpanded((v) => {
      localStorage.setItem(STORAGE_KEY, String(!v))
      return !v
    })
  }

  // Évite le flash de contenu avant hydratation
  if (!mounted) return <aside className="w-16 h-screen shrink-0 border-r border-border/50" />

  return (
    <aside
      className={cn(
        "flex h-screen shrink-0 flex-col border-r border-border/60 bg-muted transition-all duration-200",
        expanded ? "w-52" : "w-16"
      )}
    >
      {/* Logo */}
      <div className={cn("flex items-center gap-3 px-3 py-5", expanded ? "justify-start" : "justify-center")}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-foreground">
          <Server className="h-4 w-4 text-background" />
        </div>
        {expanded && (
          <span className="font-semibold text-[13px] tracking-tight truncate">ERP Freelance</span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-0.5 px-2">
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              title={expanded ? undefined : label}
              className={cn(
                "group relative flex h-9 items-center gap-2.5 rounded-lg px-2.5 transition-colors",
                expanded ? "w-full" : "w-9 justify-center",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground/60 hover:bg-accent hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {expanded && (
                <span className="text-[13px] font-medium tracking-tight truncate">{label}</span>
              )}
              {!expanded && (
                <span className="pointer-events-none absolute left-14 z-50 hidden whitespace-nowrap rounded-lg bg-popover border border-border px-2.5 py-1 text-xs font-medium text-popover-foreground shadow-sm group-hover:block">
                  {label}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Toggle */}
      <div className={cn("px-2 pb-4 space-y-0.5", expanded ? "" : "flex flex-col items-center")}>
        <ThemeToggle expanded={expanded} />
        <button
          onClick={toggle}
          className={cn(
            "flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-foreground/40 transition-colors hover:bg-accent hover:text-foreground",
            expanded ? "w-full" : "w-9 justify-center"
          )}
          title={expanded ? "Réduire" : "Agrandir"}
        >
          {expanded
            ? <PanelLeftClose className="h-4 w-4 shrink-0" />
            : <PanelLeftOpen className="h-4 w-4 shrink-0" />
          }
          {expanded && <span className="text-[13px] font-medium tracking-tight truncate">Réduire</span>}
        </button>
      </div>
    </aside>
  )
}
