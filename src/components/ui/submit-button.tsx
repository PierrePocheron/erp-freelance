"use client"

import { useFormStatus } from "react-dom"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

/**
 * Bouton de soumission qui se désactive tant que le formulaire est en cours
 * d'envoi.
 *
 * React ne dédoublonne pas les envois de formulaire et Next met les server
 * actions en file : sans ce garde, un double clic exécute l'action DEUX fois —
 * deux mails au client, deux factures (et deux numéros consommés dans la
 * séquence légale). Se lit depuis le `<form action>` parent via `useFormStatus`,
 * donc s'utilise tel quel dans un Server Component.
 */
export function SubmitButton({
  pendingLabel,
  children,
  disabled,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "type"> & { pendingLabel?: React.ReactNode }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending || disabled} aria-busy={pending || undefined} {...props}>
      {pending && <Loader2 className="animate-spin" />}
      {pending && pendingLabel !== undefined ? pendingLabel : children}
    </Button>
  )
}
