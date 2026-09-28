import { classifyTech } from "@/lib/tech-icons"

/**
 * Icône d'une techno : SVG Devicon bundlé localement sur une pastille ronde blanche
 * (lisible en clair ET sombre, y compris les logos noirs). Sans icône de marque →
 * repli « initiales » sur une pastille ronde teintée de la couleur de la techno.
 * Ronde à dessein : ne déborde jamais du coin arrondi d'un chip. Composant pur.
 */
export function TechIcon({ name, size = 18 }: { name: string; size?: number }) {
  const { tech, color } = classifyTech(name)
  const box = size + 6
  if (tech?.slug) {
    return (
      <span
        className="inline-flex items-center justify-center rounded-full bg-white ring-1 ring-black/5 shrink-0"
        style={{ width: box, height: box }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/tech-icons/${tech.slug}.svg`} alt="" aria-hidden width={size} height={size} style={{ width: size, height: size }} />
      </span>
    )
  }
  const initials = name.trim().replace(/[^\p{L}\p{N}]/gu, "").slice(0, 2).toUpperCase() || "?"
  return (
    <span
      className="inline-flex items-center justify-center rounded-full font-semibold text-white shrink-0"
      style={{ width: box, height: box, backgroundColor: color, fontSize: Math.round(size * 0.46) }}
      aria-hidden
    >
      {initials}
    </span>
  )
}
