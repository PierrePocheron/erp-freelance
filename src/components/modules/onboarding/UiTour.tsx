"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import {
  PanelLeft, Search, Bell, Settings2,
  LayoutGrid, Plus, ListTodo, ChevronLeft, ChevronRight,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { readNeedsOnboarding, readScoped, writeScoped } from "@/hooks/use-modules"

// useLayoutEffect côté serveur émet un warning React → variante isomorphe
// (le composant est SSR même s'il rend `null` tant que le tour n'a pas démarré).
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect

// Dispatché par OnboardingGate à la fin du premier onboarding — démarre le
// tour dans la même session, sans attendre un rechargement.
export const START_UI_TOUR_EVENT = "erp:start-ui-tour"
const TOUR_SEEN_KEY = "erp-ui-tour-seen"

type Step = {
  // Valeur `data-tour` de l'élément à mettre en avant. Absent → bulle centrée.
  target?: string
  icon: React.ReactNode
  title: string
  body: string
}

// Desktop : on ancre sur la sidebar, la recherche, la cloche puis les réglages.
const DESKTOP_STEPS: Step[] = [
  {
    target: "sidebar",
    icon: <PanelLeft className="h-5 w-5" />,
    title: "La navigation",
    body: "Tous vos modules actifs sont ici, à gauche. Cliquez sur le logo tout en haut pour déplier la barre et afficher les libellés.",
  },
  {
    target: "search",
    icon: <Search className="h-5 w-5" />,
    title: "Rechercher partout",
    body: "Ce bouton — ou le raccourci ⌘K — ouvre la recherche globale : contacts, factures, projets, revenus… et même un montant (« 60 » retrouve un revenu de 60 €).",
  },
  {
    target: "notifications",
    icon: <Bell className="h-5 w-5" />,
    title: "Vos notifications",
    body: "La cloche regroupe invitations et alertes. Sur mobile, activez les notifications push pour les recevoir sur votre téléphone.",
  },
  {
    target: "settings",
    icon: <Settings2 className="h-5 w-5" />,
    title: "Des modules à la carte",
    body: "Paramètres → Modules pour activer ou retirer ce que vous voulez, quand vous voulez. L'interface s'ajuste instantanément.",
  },
]

// Mobile : recherche, grille de modules, bouton « + », puis un mot sur les listes.
const MOBILE_STEPS: Step[] = [
  {
    target: "mobile-search",
    icon: <Search className="h-5 w-5" />,
    title: "Rechercher",
    body: "La recherche globale trouve contacts, factures, projets, revenus… et même un montant (« 60 » retrouve un revenu de 60 €).",
  },
  {
    target: "mobile-grid",
    icon: <LayoutGrid className="h-5 w-5" />,
    title: "Vos modules",
    body: "La grille regroupe vos modules actifs. Touchez une carte pour ouvrir un module ; la sélection se règle dans Paramètres → Modules.",
  },
  {
    target: "quick-add",
    icon: <Plus className="h-5 w-5" />,
    title: "Saisie express",
    body: "Le « + » ajoute une dépense, une tâche, un revenu reçu ou une interaction prospect en quelques taps. Il s'efface au scroll et revient dès que vous remontez.",
  },
  {
    icon: <ListTodo className="h-5 w-5" />,
    title: "Cocher en mobilité",
    body: "Marquer un revenu reçu, confirmer une tâche, pointer un prospect contacté : tout se fait au pouce, directement dans les listes.",
  },
]

const PADDING = 12   // marge minimale avec les bords de l'écran
const GAP = 14       // espace entre la cible et la bulle
const SPOT_PAD = 8   // halo autour de la cible

/**
 * Tour guidé « spotlight » : chaque étape met en avant un vrai élément de
 * l'interface (halo + fond assombri autour via un box-shadow géant) et place une
 * bulle explicative juste à côté, du côté où il y a le plus de place. S'adapte au
 * support (jeux d'étapes desktop / mobile) et se recalcule au resize/scroll. Une
 * étape dont la cible est absente (module masqué, autre support) tombe en bulle
 * centrée. S'affiche une seule fois par compte (localStorage scopé), soit juste
 * après le premier onboarding (événement), soit au premier chargement.
 */
export function UiTour() {
  const [steps, setSteps] = useState<Step[] | null>(null)
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [tip, setTip] = useState<{ top: number; left: number } | null>(null)
  const tipRef = useRef<HTMLDivElement>(null)

  const start = useCallback(() => {
    const isDesktop = window.matchMedia("(min-width: 640px)").matches
    const all = isDesktop ? DESKTOP_STEPS : MOBILE_STEPS
    // Ne garde que les étapes affichables : sans cible, ou dont la cible existe.
    const usable = all.filter((s) => !s.target || document.querySelector(`[data-tour="${s.target}"]`))
    setSteps(usable.length ? usable : all)
    setIndex(0)
  }, [])

  useEffect(() => {
    // Jamais vu + onboarding déjà passé → départ automatique (léger délai pour
    // laisser la page se peindre). Sinon c'est START_UI_TOUR_EVENT (fin de
    // l'onboarding) qui démarre le tour.
    let timer: ReturnType<typeof setTimeout> | undefined
    if (!readScoped(TOUR_SEEN_KEY) && !readNeedsOnboarding()) {
      timer = setTimeout(start, 800)
    }
    window.addEventListener(START_UI_TOUR_EVENT, start)
    return () => {
      if (timer) clearTimeout(timer)
      window.removeEventListener(START_UI_TOUR_EVENT, start)
    }
  }, [start])

  const step = steps ? steps[index] : null

  // Mesure de la cible : scroll dans la vue puis rect, recalculé au resize/scroll.
  useEffect(() => {
    const el = step?.target
      ? document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`)
      : null
    if (!el) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRect(null)
      return
    }
    let raf = 0
    const measure = () => setRect(el.getBoundingClientRect())
    el.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" })
    measure()
    const onMove = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(measure) }
    window.addEventListener("resize", onMove)
    window.addEventListener("scroll", onMove, true)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("resize", onMove)
      window.removeEventListener("scroll", onMove, true)
    }
  }, [step])

  // Position de la bulle, calculée après mesure de sa hauteur réelle (avant peinture).
  useIsoLayoutEffect(() => {
    if (!step) { setTip(null); return }
    const vw = window.innerWidth, vh = window.innerHeight
    const width = Math.min(340, vw - PADDING * 2)
    const h = tipRef.current?.offsetHeight ?? 220
    if (!rect) {
      setTip({ top: Math.max(PADDING, (vh - h) / 2), left: Math.max(PADDING, (vw - width) / 2) })
      return
    }
    const below = vh - rect.bottom, above = rect.top
    const right = vw - rect.right, left = rect.left
    let top: number, x: number
    if (below >= h + GAP)       { top = rect.bottom + GAP;      x = rect.left + rect.width / 2 - width / 2 }
    else if (above >= h + GAP)  { top = rect.top - GAP - h;     x = rect.left + rect.width / 2 - width / 2 }
    else if (right >= width + GAP) { x = rect.right + GAP;      top = rect.top + rect.height / 2 - h / 2 }
    else if (left >= width + GAP)  { x = rect.left - GAP - width; top = rect.top + rect.height / 2 - h / 2 }
    else { top = below >= above ? rect.bottom + GAP : rect.top - GAP - h; x = rect.left + rect.width / 2 - width / 2 }
    x = Math.max(PADDING, Math.min(x, vw - width - PADDING))
    top = Math.max(PADDING, Math.min(top, vh - h - PADDING))
    setTip({ top, left: x })
  }, [step, rect])

  const close = useCallback(() => {
    writeScoped(TOUR_SEEN_KEY, "1")
    setSteps(null); setRect(null); setTip(null)
  }, [])

  // Échap ferme le tour.
  useEffect(() => {
    if (!step) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [step, close])

  if (!steps || !step) return null

  const isLast = index === steps.length - 1
  const width = typeof window !== "undefined" ? Math.min(340, window.innerWidth - PADDING * 2) : 320

  return (
    <div className="fixed inset-0 z-[110]" role="dialog" aria-modal="true" aria-label="Visite guidée">
      {/* Capteur de clics : bloque l'interface derrière (les boutons du tour, au-dessus, restent cliquables) */}
      <div className="absolute inset-0" />

      {/* Halo sur la cible (le box-shadow géant assombrit tout le reste) */}
      {rect && (
        <div
          className="pointer-events-none fixed rounded-xl ring-2 ring-primary transition-all duration-300 ease-out"
          style={{
            top: rect.top - SPOT_PAD,
            left: rect.left - SPOT_PAD,
            width: rect.width + SPOT_PAD * 2,
            height: rect.height + SPOT_PAD * 2,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.6)",
          }}
        />
      )}
      {/* Fond assombri quand aucune cible (bulle centrée) */}
      {!rect && <div className="pointer-events-none absolute inset-0 bg-black/60" />}

      {/* Bulle explicative */}
      <div
        ref={tipRef}
        className="fixed rounded-2xl bg-background border border-border shadow-2xl overflow-hidden transition-[top,left] duration-300 ease-out"
        style={{
          width,
          top: tip?.top ?? -9999,
          left: tip?.left ?? 0,
          opacity: tip ? 1 : 0,
        }}
      >
        <div className="p-4 pb-3">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              {step.icon}
            </div>
            <h2 className="text-sm font-bold tracking-tight">{step.title}</h2>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{step.body}</p>
        </div>

        {/* Progression */}
        <div className="flex items-center justify-center gap-1.5 pb-3">
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
        <div className="flex items-center justify-between gap-2 border-t border-border/50 px-3 py-2.5">
          <button
            type="button"
            onClick={close}
            className="h-8 px-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Passer
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground tabular-nums mr-1">{index + 1}/{steps.length}</span>
            {index > 0 && (
              <button
                type="button"
                onClick={() => setIndex((i) => i - 1)}
                aria-label="Étape précédente"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-input text-muted-foreground hover:bg-muted/50 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => (isLast ? close() : setIndex((i) => i + 1))}
              className="flex h-8 items-center gap-1 rounded-lg bg-primary px-3.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              {isLast ? "Terminer" : "Suivant"}
              {!isLast && <ChevronRight className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
