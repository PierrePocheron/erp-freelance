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
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/crm", icon: Users, label: "CRM" },
  { href: "/facturation", icon: FileText, label: "Facturation" },
  { href: "/projets", icon: Code2, label: "Projets" },
  { href: "/calendrier", icon: Calendar, label: "Calendrier" },
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
        "flex h-screen shrink-0 flex-col border-r border-border/50 bg-background/80 backdrop-blur-sm transition-all duration-200",
        expanded ? "w-52" : "w-16"
      )}
    >
      {/* Logo */}
      <div className={cn("flex items-center gap-3 px-3 py-6", expanded ? "justify-start" : "justify-center")}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary">
          <Server className="h-5 w-5 text-primary-foreground" />
        </div>
        {expanded && (
          <span className="font-semibold text-sm truncate">ERP Freelance</span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-1 px-2">
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              title={expanded ? undefined : label}
              className={cn(
                "group flex h-10 items-center gap-3 rounded-xl px-2.5 transition-colors",
                expanded ? "w-full" : "w-10 justify-center",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {expanded && (
                <span className="text-sm font-medium truncate">{label}</span>
              )}
              {/* Tooltip uniquement en mode réduit */}
              {!expanded && (
                <span className="pointer-events-none absolute left-16 z-50 hidden whitespace-nowrap rounded-md bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md group-hover:block">
                  {label}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Toggle */}
      <div className={cn("px-2 pb-5", expanded ? "" : "flex justify-center")}>
        <button
          onClick={toggle}
          className={cn(
            "flex h-9 items-center gap-3 rounded-xl px-2.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
            expanded ? "w-full" : "w-10 justify-center"
          )}
          title={expanded ? "Réduire" : "Agrandir"}
        >
          {expanded
            ? <PanelLeftClose className="h-4 w-4 shrink-0" />
            : <PanelLeftOpen className="h-4 w-4 shrink-0" />
          }
          {expanded && <span className="text-sm truncate">Réduire</span>}
        </button>
      </div>
    </aside>
  )
}
