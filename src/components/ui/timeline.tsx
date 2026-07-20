import { cn } from "@/lib/utils"

/**
 * Frise chronologique — squelette visuel partagé (contacts, projets…) :
 * une ligne verticale à gauche, un point coloré par entrée. Le contenu de
 * chaque entrée est rendu par l'appelant via <TimelineItem>. Purement
 * présentationnel, utilisable côté serveur comme client.
 */
export function Timeline({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <ol className={cn(
      "relative space-y-4 pl-5 before:absolute before:left-[5px] before:top-1.5 before:bottom-1.5 before:w-px before:bg-border",
      className,
    )}>
      {children}
    </ol>
  )
}

/**
 * Une entrée de frise : le point coloré (dotClassName = classe de fond, ex.
 * "bg-emerald-400") posé sur la ligne, puis le contenu libre.
 */
export function TimelineItem({ dotClassName, children }: { dotClassName?: string; children: React.ReactNode }) {
  return (
    <li className="relative">
      <span className={cn("absolute -left-5 top-1 h-[11px] w-[11px] rounded-full border-2 border-card", dotClassName ?? "bg-muted-foreground")} />
      {children}
    </li>
  )
}
