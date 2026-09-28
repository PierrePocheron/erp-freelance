import { Skeleton } from "@/components/ui/skeleton"

/**
 * Formes d'écrans de chargement, une par gabarit de page (liste, cartes, bento,
 * fiche, calendrier, panneau). Chaque segment de route pose son `loading.tsx`
 * avec la forme correspondante : le squelette occupe la même place que le vrai
 * contenu, donc pas de saut de mise en page à l'arrivée des données.
 *
 * Le titre est écrit en clair quand la route le connaît. La plupart des pages
 * masquent leur `<h1>` au-delà de `sm` (le fil d'Ariane de l'en-tête le remplace) :
 * c'est le défaut. Les pages qui l'affichent toujours passent `titleAlways`, sinon
 * l'emplacement du titre resterait vide dans le squelette et le contenu sauterait
 * de ~40 px à l'arrivée des données. Sans titre du tout → bloc gris.
 */

function Frame({ children }: { children: React.ReactNode }) {
  return (
    // `aria-busy` marque la région comme en cours de construction ; le message,
    // lui, vit dans SA propre région live (`role="status"`). Les deux sur le même
    // élément se neutralisent : ARIA interdit d'annoncer une région `busy`, donc
    // le texte n'était jamais lu.
    <div className="space-y-6" aria-busy="true">
      {children}
      <span role="status" className="sr-only">Chargement…</span>
    </div>
  )
}

function Header({ title, action = true, titleAlways = false }: { title?: string; action?: boolean; titleAlways?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-2">
        {title
          ? <h1 className={`text-2xl font-bold tracking-tight${titleAlways ? "" : " sm:hidden"}`}>{title}</h1>
          : <Skeleton className="h-7 w-52" />}
        <Skeleton className="h-3.5 w-32" />
      </div>
      {action && <Skeleton className="h-9 w-28 rounded-lg" />}
    </div>
  )
}

function Stats({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-20 rounded-xl" />
      ))}
    </div>
  )
}

/** Liste / tableau : en-tête, compteurs, puis des lignes dans une carte. */
export function ListSkeleton({
  title, stats = 4, rows = 7, action = true, titleAlways = false,
}: { title?: string; stats?: number; rows?: number; action?: boolean; titleAlways?: boolean }) {
  return (
    <Frame>
      <Header title={title} action={action} titleAlways={titleAlways} />
      {stats > 0 && <Stats count={stats} />}
      <div className="rounded-xl border border-border/50 bg-card divide-y divide-border/50">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-5 py-3.5">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-2/5" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-3.5 w-16" />
          </div>
        ))}
      </div>
    </Frame>
  )
}

/** Grille de cartes (projets, candidatures…). */
export function CardsSkeleton({
  title, stats = 4, cards = 6, titleAlways = false,
}: { title?: string; stats?: number; cards?: number; titleAlways?: boolean }) {
  return (
    <Frame>
      <Header title={title} titleAlways={titleAlways} />
      {stats > 0 && <Stats count={stats} />}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: cards }).map((_, i) => (
          <div key={i} className="space-y-3 rounded-xl border border-border/50 bg-card p-4">
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <Skeleton className="h-4 flex-1" />
            </div>
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-1.5 rounded-full" />
          </div>
        ))}
      </div>
    </Frame>
  )
}

/** Tableau de bord / bento : KPIs puis panneaux de tailles inégales. */
export function BentoSkeleton({
  title, kpis = 4, titleAlways = false,
}: { title?: string; kpis?: number; titleAlways?: boolean }) {
  return (
    <Frame>
      <Header title={title} action={false} titleAlways={titleAlways} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: kpis }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-72 rounded-xl lg:col-span-2" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    </Frame>
  )
}

/** Fiche (projet, contact, société, facture…) : le nom est inconnu → bloc gris. */
export function DetailSkeleton() {
  return (
    <Frame>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-11 w-11 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-3.5 w-32" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Skeleton className="h-44 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </div>
    </Frame>
  )
}

/** Calendrier : barre d'outils + grille du mois. */
export function CalendarSkeleton({ title }: { title?: string }) {
  return (
    <Frame>
      <Header title={title} />
      <div className="rounded-xl border border-border/50 bg-card p-3">
        <div className="mb-3 grid grid-cols-7 gap-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-10 justify-self-center" />
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 35 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      </div>
    </Frame>
  )
}

/** Un seul grand panneau (graphe, rapport…). */
export function PanelSkeleton({ title, height = "h-[70vh]", titleAlways = false }: { title?: string; height?: string; titleAlways?: boolean }) {
  return (
    <Frame>
      <Header title={title} action={false} titleAlways={titleAlways} />
      <Skeleton className={`w-full rounded-xl ${height}`} />
    </Frame>
  )
}
