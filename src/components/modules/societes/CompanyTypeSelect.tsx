"use client"

import { useTransition } from "react"
import { updateCompanyType } from "@/actions/crm"

export const COMPANY_TYPE_CONFIG: Record<string, { label: string; className: string }> = {
  CLIENT:      { label: "Client",       className: "bg-emerald-500/15 text-emerald-600 border-emerald-500/20" },
  ESN:         { label: "ESN / SSII",   className: "bg-indigo-500/15 text-indigo-600 border-indigo-500/20"   },
  RECRUTEMENT: { label: "Recrutement",  className: "bg-sky-500/15 text-sky-600 border-sky-500/20"            },
  PARTENAIRE:  { label: "Partenaire",   className: "bg-violet-500/15 text-violet-600 border-violet-500/20"   },
  FOURNISSEUR: { label: "Fournisseur",  className: "bg-amber-500/15 text-amber-600 border-amber-500/20"      },
  AUTRE:       { label: "Autre",        className: "bg-muted text-muted-foreground border-border"             },
}

export function CompanyTypeSelect({
  companyId,
  value,
}: {
  companyId: string
  value: string | null
}) {
  const [, startTransition] = useTransition()
  const current = value ? COMPANY_TYPE_CONFIG[value] : null

  return (
    <select
      value={value ?? ""}
      onChange={(e) =>
        startTransition(() => updateCompanyType(companyId, e.target.value || null))
      }
      className={`rounded-full border px-2.5 py-0.5 text-xs font-medium cursor-pointer focus:outline-none ${
        current ? current.className : "bg-muted/50 text-muted-foreground border-border"
      }`}
    >
      <option value="">— Type —</option>
      {Object.entries(COMPANY_TYPE_CONFIG).map(([v, cfg]) => (
        <option key={v} value={v}>{cfg.label}</option>
      ))}
    </select>
  )
}
