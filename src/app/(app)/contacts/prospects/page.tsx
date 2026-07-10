import { redirect } from "next/navigation"

// La prospection est devenue un module autonome — ancienne URL conservée
// pour les habitudes/favoris.
export default function LegacyProspectsPage() {
  redirect("/prospection")
}
