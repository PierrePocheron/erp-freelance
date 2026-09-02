import { resolveTech } from "@/lib/tech-icons"

const FALLBACK_COLORS = [
  "#6366f1", "#8b5cf6", "#0ea5e9", "#10b981", "#f59e0b",
  "#ef4444", "#ec4899", "#64748b", "#14b8a6", "#f97316",
]
function colorForName(name: string): string {
  let h = 0
  for (const ch of name.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) | 0
  return FALLBACK_COLORS[Math.abs(h) % FALLBACK_COLORS.length]
}

/**
 * Icône d'une techno : SVG Devicon bundlé localement (tuile blanche pour rester
 * lisible en clair ET sombre, y compris les logos noirs) ; sinon pastille
 * « initiales » colorée déterministe. Composant pur — utilisable serveur ou client.
 */
export function TechIcon({ name, size = 18 }: { name: string; size?: number }) {
  const tech = resolveTech(name)
  const box = size + 6
  if (tech) {
    return (
      <span
        className="inline-flex items-center justify-center rounded bg-white ring-1 ring-black/5 shrink-0"
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
      className="inline-flex items-center justify-center rounded font-semibold text-white shrink-0"
      style={{ width: box, height: box, backgroundColor: colorForName(name), fontSize: Math.round(size * 0.5) }}
      aria-hidden
    >
      {initials}
    </span>
  )
}
