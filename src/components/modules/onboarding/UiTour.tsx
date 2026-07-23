"use client"

import { useEffect, useState } from "react"
import {
  PanelLeft, Search, LayoutDashboard, Bell, Settings2,
  LayoutGrid, Plus, Home, ListTodo, ChevronLeft, ChevronRight,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { readNeedsOnboarding, readScoped, writeScoped } from "@/hooks/use-modules"

// Dispatché par OnboardingGate à la fin du premier onboarding — démarre le
// tour dans la même session, sans attendre un rechargement.
export const START_UI_TOUR_EVENT = "erp:start-ui-tour"
const TOUR_SEEN_KEY = "erp-ui-tour-seen"

type Step = { icon: React.ReactNode; title: string; body: string }

const DESKTOP_STEPS: Step[] = [
  {
    icon: <PanelLeft className="h-6 w-6" />,
    title: "La sidebar, votre navigation",
    body: "Tous vos modules actifs sont à gauche. Cliquez sur le logo pour la déplier et voir les libellés.",
  },
  {
    icon: <Search className="h-6 w-6" />,
    title: "Tout retrouver avec ⌘K",
    body: "La recherche globale trouve contacts, factures, projets, revenus… et même un montant (« 60 » retrouve un revenu de 60 €).",
  },
  {
    icon: <LayoutDashboard className="h-6 w-6" />,
    title: "Le dashboard s'adapte",
    body: "Les cartes reflètent vos modules et vos données du jour. Les coches vertes marquent une réception ou confirment une tâche sans quitter la page.",
  },
  {
    icon: <Bell className="h-6 w-6" />,
    title: "Notifications",
    body: "La cloche en haut à droite regroupe invitations et alertes. Sur mobile, activez les notifications push pour les recevoir sur votre téléphone.",
  },
  {
    icon: <Settings2 className="h-6 w-6" />,
    title: "Des modules à la carte",
    body: "Paramètres → Modules pour activer ou retirer ce que vous voulez, quand vous voulez. L'interface s'ajuste instantanément.",
  },
]

const MOBILE_STEPS: Step[] = [
  {
    icon: <LayoutGrid className="h-6 w-6" />,
    title: "L'accueil, votre menu",
    body: "La grille regroupe vos modules actifs, avec la recherche juste au-dessus. Les cartes « À traiter » remontent ce qui demande votre attention.",
  },
  {
    icon: <Plus className="h-6 w-6" />,
    title: "Le « + », saisie express",
    body: "Une dépense, une tâche, une interaction prospect ou un revenu reçu en quelques taps. Il s'efface quand vous scrollez, revient dès que vous remontez.",
  },
  {
    icon: <Home className="h-6 w-6" />,
    title: "Revenir au menu",
    body: "Le rond en bas à gauche vous ramène à l'accueil depuis n'importe quel module — pratique en plein écran, sans barre de navigateur.",
  },
  {
    icon: <ListTodo className="h-6 w-6" />,
    title: "Cocher en mobilité",
    body: "Marquer un revenu reçu, confirmer une tâche, pointer un prospect contacté : tout se fait au pouce, directement dans les listes.",
  },
  {
    icon: <Settings2 className="h-6 w-6" />,
    title: "Des modules à la carte",
    body: "Paramètres → Modules pour activer ou retirer ce que vous voulez, quand vous voulez. Votre choix de départ n'engage à rien.",
  },
]

/**
 * Tour guidé de l'interface — série de pop-ups façon première ouverture d'app
 * mobile. S'affiche une seule fois (localStorage), soit juste après le premier
 * onboarding (événement), soit au premier chargement si jamais vu. Étapes
 * adaptées au support (desktop : sidebar/⌘K… — mobile : grille/+/accueil…).
 */
export function UiTour() {
  const [steps, setSteps] = useState<Step[] | null>(null)
  const [index, setIndex] = useState(0)

  function start() {
    const isDesktop = window.matchMedia("(min-width: 640px)").matches
    setSteps(isDesktop ? DESKTOP_STEPS : MOBILE_STEPS)
    setIndex(0)
  }

  useEffect(() => {
    // Jamais vu + onboarding déjà passé → départ automatique (léger délai
    // pour laisser la page se peindre). Si l'onboarding est en cours, c'est
    // l'événement START_UI_TOUR_EVENT qui prendra le relais à sa validation.
    let timer: ReturnType<typeof setTimeout> | undefined
    if (!readScoped(TOUR_SEEN_KEY) && !readNeedsOnboarding()) {
      timer = setTimeout(start, 800)
    }
    window.addEventListener(START_UI_TOUR_EVENT, start)
    return () => {
      if (timer) clearTimeout(timer)
      window.removeEventListener(START_UI_TOUR_EVENT, start)
    }
  }, [])

  function close() {
    writeScoped(TOUR_SEEN_KEY, "1")
    setSteps(null)
  }

  if (!steps) return null

  const step = steps[index]
  const isLast = index === steps.length - 1

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl bg-background border border-border shadow-2xl overflow-hidden">
        {/* Illustration */}
        <div className="flex items-center justify-center pt-8 pb-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            {step.icon}
          </div>
        </div>

        {/* Contenu */}
        <div className="px-6 pb-5 text-center space-y-2">
          <h2 className="text-base font-bold tracking-tight">{step.title}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{step.body}</p>
        </div>

        {/* Points de progression */}
        <div className="flex items-center justify-center gap-1.5 pb-5">
          {steps.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Étape ${i + 1}`}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === index ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/25"
              )}
            />
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-2 border-t border-border/50 px-4 py-3">
          <button
            type="button"
            onClick={close}
            className="h-9 px-3 rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Passer
          </button>
          <div className="flex items-center gap-2">
            {index > 0 && (
              <button
                type="button"
                onClick={() => setIndex((i) => i - 1)}
                aria-label="Étape précédente"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-input text-muted-foreground hover:bg-muted/50 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => (isLast ? close() : setIndex((i) => i + 1))}
              className="flex h-9 items-center gap-1 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              {isLast ? "C'est parti !" : "Suivant"}
              {!isLast && <ChevronRight className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
