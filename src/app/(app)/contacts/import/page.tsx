import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasContactsScope } from "@/lib/google-contacts"
import { ContactImportWizard } from "@/components/modules/crm/ContactImportWizard"

/**
 * Contacts › Importer — enrichit le carnet ERP depuis le téléphone (.vcf ou sélecteur natif)
 * ou Google Contacts, avec validation champ par champ avant écriture.
 */
export default async function ContactImportPage() {
  const session = await auth()
  const userId = session!.user.id
  const [googleScope, contacts] = await Promise.all([
    hasContactsScope(userId),
    prisma.client.findMany({ where: { userId }, orderBy: { name: "asc" }, select: { id: true, name: true, company: true } }),
  ])

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link href="/contacts" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ChevronLeft className="h-4 w-4" /> Contacts
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Importer des contacts</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Depuis ton téléphone ou Google Contacts. L&apos;ERP rapproche chaque contact avec ceux déjà présents
          et te <strong>propose</strong> les emails, téléphones et noms manquants — tu valides avant toute écriture.
        </p>
      </div>
      <ContactImportWizard hasGoogleScope={googleScope} allContacts={contacts} />
    </div>
  )
}
