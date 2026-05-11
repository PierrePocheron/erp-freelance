import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { saveProfile } from "@/actions/settings"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { User, Building2, CreditCard, FileText } from "lucide-react"

export default async function SettingsPage() {
  const session = await auth()
  const userId = session!.user.id

  const [profile, user] = await Promise.all([
    prisma.userProfile?.findUnique({ where: { userId } }).catch(() => null) ?? null,
    prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true, image: true } }),
  ])

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Paramètres</h1>
        <p className="text-sm text-muted-foreground mt-1">Informations professionnelles utilisées dans vos devis et factures</p>
      </div>

      <form
        action={async (fd: FormData) => {
          "use server"
          await saveProfile(userId, {
            companyName: (fd.get("companyName") as string) || null,
            siret: (fd.get("siret") as string) || null,
            address: (fd.get("address") as string) || null,
            postalCode: (fd.get("postalCode") as string) || null,
            city: (fd.get("city") as string) || null,
            country: (fd.get("country") as string) || null,
            phone: (fd.get("phone") as string) || null,
            website: (fd.get("website") as string) || null,
            iban: (fd.get("iban") as string) || null,
            bic: (fd.get("bic") as string) || null,
            quotePrefix: (fd.get("quotePrefix") as string) || "DEV",
            invoicePrefix: (fd.get("invoicePrefix") as string) || "FAC",
          })
        }}
        className="space-y-6"
      >
        {/* Identité */}
        <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold text-sm">Identité</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Nom complet</label>
              <Input value={user?.name ?? ""} disabled className="h-8 bg-muted/40" />
              <p className="text-xs text-muted-foreground">Modifiable via votre compte Google</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Email</label>
              <Input value={user?.email ?? ""} disabled className="h-8 bg-muted/40" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Nom commercial / entreprise</label>
            <Input name="companyName" defaultValue={profile?.companyName ?? ""} placeholder="Agence SuperDev" className="h-8" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Téléphone</label>
              <Input name="phone" defaultValue={profile?.phone ?? ""} placeholder="+33 6 12 34 56 78" className="h-8" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Site web</label>
              <Input name="website" defaultValue={profile?.website ?? ""} placeholder="https://monsite.fr" className="h-8" />
            </div>
          </div>
        </div>

        {/* Adresse */}
        <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold text-sm">Adresse & Légal</h2>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Adresse</label>
            <Input name="address" defaultValue={profile?.address ?? ""} placeholder="12 rue de la Paix" className="h-8" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Code postal</label>
              <Input name="postalCode" defaultValue={profile?.postalCode ?? ""} placeholder="75001" className="h-8" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Ville</label>
              <Input name="city" defaultValue={profile?.city ?? ""} placeholder="Paris" className="h-8" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Pays</label>
              <Input name="country" defaultValue={profile?.country ?? "France"} placeholder="France" className="h-8" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">SIRET</label>
            <Input name="siret" defaultValue={profile?.siret ?? ""} placeholder="123 456 789 00012" className="h-8 font-mono" />
          </div>
        </div>

        {/* IBAN */}
        <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold text-sm">Coordonnées bancaires</h2>
          </div>
          <p className="text-xs text-muted-foreground">Affichées en bas des factures pour faciliter le paiement</p>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">IBAN</label>
            <Input name="iban" defaultValue={profile?.iban ?? ""} placeholder="FR76 3000 6000 0112 3456 7890 189" className="h-8 font-mono" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">BIC</label>
            <Input name="bic" defaultValue={profile?.bic ?? ""} placeholder="BNPAFRPP" className="h-8 font-mono" />
          </div>
        </div>

        {/* Numérotation */}
        <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold text-sm">Numérotation</h2>
          </div>
          <p className="text-xs text-muted-foreground">Préfixes utilisés pour générer les numéros de documents (ex: DEV-2026-001)</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Préfixe devis</label>
              <Input name="quotePrefix" defaultValue={profile?.quotePrefix ?? "DEV"} placeholder="DEV" className="h-8 font-mono" maxLength={6} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Préfixe facture</label>
              <Input name="invoicePrefix" defaultValue={profile?.invoicePrefix ?? "FAC"} placeholder="FAC" className="h-8 font-mono" maxLength={6} />
            </div>
          </div>
        </div>

        <Button type="submit" className="w-full">Enregistrer les modifications</Button>
      </form>
    </div>
  )
}
