import type { SkillFamily } from "@/generated/prisma/enums"

/**
 * Table des technos → icône Devicon (bundlée en local dans /public/tech-icons, aucune
 * requête réseau) + famille + couleur de marque. Les SVG sont copiés depuis le paquet
 * `devicon` par `scripts/gen-tech-icons.ts` (nom de fichier = `slug`).
 * Les technos sans logo de marque (GORM, Nmap, concepts…) ne sont pas ici : elles
 * tombent sur le fallback « initiales », mais leur famille peut venir de FAMILY_HINTS.
 */
export type TechDef = {
  slug: string        // dossier devicon + nom du fichier public (/tech-icons/<slug>.svg)
  variant: string     // variante SVG devicon souhaitée (le script retombe sur une autre si absente)
  family: SkillFamily
  color: string       // couleur de marque (accent de la pastille)
  label: string       // libellé canonique
  aliases?: string[]
}

// Ordre + libellé d'affichage des familles (regroupement des pastilles).
export const SKILL_FAMILIES: { key: SkillFamily; label: string }[] = [
  { key: "FRONTEND", label: "Front" },
  { key: "BACKEND",  label: "Back" },
  { key: "DATABASE", label: "Données" },
  { key: "DEVOPS",   label: "DevOps / Infra" },
  { key: "MOBILE",   label: "Mobile" },
  { key: "SECURITY", label: "Sécurité" },
  { key: "TOOL",     label: "Outils" },
  { key: "CONCEPT",  label: "Concepts" },
  { key: "OTHER",    label: "Autre" },
]

export const SKILL_FAMILY_LABEL = Object.fromEntries(
  SKILL_FAMILIES.map((f) => [f.key, f.label]),
) as Record<SkillFamily, string>

const TECHS: TechDef[] = [
  // Front
  { slug: "react",        variant: "original", family: "FRONTEND", color: "#61DAFB", label: "React" },
  { slug: "nextjs",       variant: "original", family: "FRONTEND", color: "#000000", label: "Next.js", aliases: ["next"] },
  { slug: "typescript",   variant: "original", family: "FRONTEND", color: "#3178C6", label: "TypeScript", aliases: ["ts"] },
  { slug: "javascript",   variant: "original", family: "FRONTEND", color: "#F7DF1E", label: "JavaScript", aliases: ["js"] },
  { slug: "tailwindcss",  variant: "original", family: "FRONTEND", color: "#38BDF8", label: "Tailwind CSS", aliases: ["tailwind"] },
  { slug: "chakraui",     variant: "original", family: "FRONTEND", color: "#319795", label: "Chakra UI", aliases: ["chakra"] },
  { slug: "astro",        variant: "original", family: "FRONTEND", color: "#FF5D01", label: "Astro" },
  { slug: "html5",        variant: "original", family: "FRONTEND", color: "#E34F26", label: "HTML5", aliases: ["html"] },
  { slug: "css3",         variant: "original", family: "FRONTEND", color: "#1572B6", label: "CSS3", aliases: ["css"] },
  { slug: "sass",         variant: "original", family: "FRONTEND", color: "#CC6699", label: "Sass", aliases: ["scss"] },
  { slug: "vuejs",        variant: "original", family: "FRONTEND", color: "#4FC08D", label: "Vue.js", aliases: ["vue"] },
  { slug: "angular",      variant: "original", family: "FRONTEND", color: "#DD0031", label: "Angular" },
  { slug: "bootstrap",    variant: "original", family: "FRONTEND", color: "#7952B3", label: "Bootstrap" },
  // Back
  { slug: "go",           variant: "original", family: "BACKEND", color: "#00ACD7", label: "Go", aliases: ["golang"] },
  { slug: "nodejs",       variant: "original", family: "BACKEND", color: "#5FA04E", label: "Node.js", aliases: ["node"] },
  { slug: "java",         variant: "original", family: "BACKEND", color: "#EA2D2E", label: "Java" },
  { slug: "spring",       variant: "original", family: "BACKEND", color: "#6DB33F", label: "Spring", aliases: ["springboot", "spring boot"] },
  { slug: "python",       variant: "original", family: "BACKEND", color: "#3776AB", label: "Python" },
  { slug: "php",          variant: "original", family: "BACKEND", color: "#777BB4", label: "PHP" },
  { slug: "laravel",      variant: "original", family: "BACKEND", color: "#FF2D20", label: "Laravel" },
  { slug: "express",      variant: "original", family: "BACKEND", color: "#000000", label: "Express", aliases: ["expressjs"] },
  { slug: "nestjs",       variant: "original", family: "BACKEND", color: "#E0234E", label: "NestJS", aliases: ["nest"] },
  { slug: "graphql",      variant: "plain",    family: "BACKEND", color: "#E10098", label: "GraphQL" },
  // Données
  { slug: "postgresql",   variant: "original", family: "DATABASE", color: "#336791", label: "PostgreSQL", aliases: ["postgres"] },
  { slug: "prisma",       variant: "original", family: "DATABASE", color: "#2D3748", label: "Prisma" },
  { slug: "mysql",        variant: "original", family: "DATABASE", color: "#4479A1", label: "MySQL" },
  { slug: "mongodb",      variant: "original", family: "DATABASE", color: "#47A248", label: "MongoDB", aliases: ["mongo"] },
  { slug: "redis",        variant: "original", family: "DATABASE", color: "#DC382D", label: "Redis" },
  { slug: "sqlite",       variant: "original", family: "DATABASE", color: "#003B57", label: "SQLite" },
  // DevOps / Infra
  { slug: "docker",       variant: "original", family: "DEVOPS", color: "#2496ED", label: "Docker" },
  { slug: "kubernetes",   variant: "original", family: "DEVOPS", color: "#326CE5", label: "Kubernetes", aliases: ["k8s"] },
  { slug: "nginx",        variant: "original", family: "DEVOPS", color: "#009639", label: "Nginx" },
  { slug: "vercel",       variant: "original", family: "DEVOPS", color: "#000000", label: "Vercel" },
  { slug: "githubactions", variant: "original", family: "DEVOPS", color: "#2088FF", label: "GitHub Actions", aliases: ["ghactions", "github actions"] },
  { slug: "amazonwebservices", variant: "original", family: "DEVOPS", color: "#FF9900", label: "AWS", aliases: ["aws"] },
  { slug: "googlecloud",  variant: "original", family: "DEVOPS", color: "#4285F4", label: "Google Cloud", aliases: ["gcp"] },
  { slug: "linux",        variant: "original", family: "DEVOPS", color: "#FCC624", label: "Linux" },
  { slug: "bash",         variant: "original", family: "DEVOPS", color: "#4EAA25", label: "Bash", aliases: ["shell"] },
  { slug: "terraform",    variant: "original", family: "DEVOPS", color: "#7B42BC", label: "Terraform" },
  // Mobile
  { slug: "capacitor",    variant: "original", family: "MOBILE", color: "#119EFF", label: "Capacitor", aliases: ["capacitorjs"] },
  { slug: "firebase",     variant: "plain",    family: "MOBILE", color: "#FFCA28", label: "Firebase" },
  { slug: "flutter",      variant: "original", family: "MOBILE", color: "#02569B", label: "Flutter" },
  // Outils
  { slug: "git",          variant: "original", family: "TOOL", color: "#F05032", label: "Git" },
  { slug: "github",       variant: "original", family: "TOOL", color: "#181717", label: "GitHub" },
  { slug: "vitest",       variant: "original", family: "TOOL", color: "#6E9F18", label: "Vitest" },
  { slug: "jest",         variant: "plain",    family: "TOOL", color: "#C21325", label: "Jest" },
  { slug: "figma",        variant: "original", family: "TOOL", color: "#F24E1E", label: "Figma" },
  { slug: "postman",      variant: "original", family: "TOOL", color: "#FF6C37", label: "Postman" },
  { slug: "vite",         variant: "original", family: "TOOL", color: "#646CFF", label: "Vite" },
]

// Famille par défaut pour des technos SANS icône de marque (fallback initiales),
// afin que l'auto-classement fonctionne quand même à la création.
const FAMILY_HINTS: Record<string, SkillFamily> = {
  gorm: "BACKEND",
  dockerswarm: "DEVOPS",
  nmap: "SECURITY",
  nuclei: "SECURITY",
  projectdiscovery: "SECURITY",
  subfinder: "SECURITY",
  httpx: "SECURITY",
  kanonymat: "SECURITY",
  yagni: "CONCEPT",
  dry: "CONCEPT",
  solid: "CONCEPT",
  ddd: "CONCEPT",
}

export function normalizeTech(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "")
}

const BY_KEY = new Map<string, TechDef>()
for (const t of TECHS) {
  BY_KEY.set(normalizeTech(t.label), t)
  BY_KEY.set(normalizeTech(t.slug), t)
  for (const a of t.aliases ?? []) BY_KEY.set(normalizeTech(a), t)
}

/** Résout une techno (par nom/alias) vers sa def d'icône, ou null (→ fallback initiales). */
export function resolveTech(name: string): TechDef | null {
  return BY_KEY.get(normalizeTech(name)) ?? null
}

/** Famille suggérée pour un nom de compétence (icône connue, sinon indice, sinon null). */
export function suggestFamily(name: string): SkillFamily | null {
  return resolveTech(name)?.family ?? FAMILY_HINTS[normalizeTech(name)] ?? null
}

/** Toutes les defs (pour le script de génération des SVG). */
export const ALL_TECHS = TECHS
