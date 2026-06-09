"use client"

import { useState } from "react"
import { UserPlus } from "lucide-react"
import { CreateClientDialog } from "@/components/modules/crm/CreateClientDialog"

export function NewContactForCompanyButton({
  userId,
  company,
}: {
  userId: string
  company: { id: string; name: string }
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
      >
        <UserPlus className="h-3.5 w-3.5" />
        Nouveau contact
      </button>
      <CreateClientDialog
        userId={userId}
        defaultCompany={company}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}
