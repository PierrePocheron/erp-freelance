"use client"

import { useState } from "react"
import { FolderPlus } from "lucide-react"
import { CreateProjectDialog } from "@/components/modules/projet/CreateProjectDialog"

type Company = { id: string; name: string; city: string | null }
type Contact = { id: string; name: string; company: string | null; companyId: string | null }

export function NewProjectForCompanyButton({
  userId,
  companyId,
  companies,
  contacts,
}: {
  userId: string
  companyId: string
  companies: Company[]
  contacts: Contact[]
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
      >
        <FolderPlus className="h-3.5 w-3.5" />
        Nouveau projet
      </button>
      <CreateProjectDialog
        userId={userId}
        companies={companies}
        contacts={contacts}
        defaultCompanyId={companyId}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}
