"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const tabs = [
  { label: "Aperçu", href: "/facturation" },
  { label: "Devis", href: "/facturation/devis" },
  { label: "Factures", href: "/facturation/factures" },
  { label: "Récurrentes", href: "/facturation/recurrentes" },
  { label: "Produits", href: "/facturation/produits" },
]

export default function FacturationLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="space-y-5">
      <div className="flex gap-1 border-b border-border">
        {tabs.map(({ label, href }) => {
          const isActive =
            href === "/facturation"
              ? pathname === "/facturation"
              : pathname.startsWith(href)
          return (
            <Link
              key={href}
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
      {children}
    </div>
  )
}
