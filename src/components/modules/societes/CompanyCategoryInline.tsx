"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { updateCompany } from "@/actions/crm"
import { CompanyCategoryCombobox, type CompanyCategory } from "./CompanyCategoryCombobox"

/**
 * Édition inline de la catégorie d'une société (fiche société). Combobox
 * « chercher ou créer » persisté immédiatement via updateCompany.
 */
export function CompanyCategoryInline({
  companyId,
  categories,
  value,
}: {
  companyId: string
  categories: CompanyCategory[]
  value: string | null
}) {
  const router = useRouter()
  const [categoryId, setCategoryId] = useState(value ?? "")
  const [, startTransition] = useTransition()

  function handleChange(id: string) {
    setCategoryId(id)
    startTransition(async () => {
      await updateCompany(companyId, { categoryId: id || null })
      router.refresh()
    })
  }

  return (
    <div className="w-52 max-w-full">
      <CompanyCategoryCombobox categories={categories} value={categoryId} onChange={handleChange} />
    </div>
  )
}
