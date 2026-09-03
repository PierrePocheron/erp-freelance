import type { SkillFamily } from "@/generated/prisma/enums"

/**
 * Classification + iconographie des technos d'un projet.
 *
 * Objectif : à partir du seul NOM d'une compétence (ex. « SpotBugs + FindSecBugs (SAST) »,
 * « Spring Cloud Gateway », « FastAPI »), déduire automatiquement :
 *   - sa FAMILLE d'affichage (Backend / Frontend / BDD / DevOps…),
 *   - son KIND (langage, framework, lib, plateforme, outil, concept) → pour distinguer la
 *     « stack principale » (framework + langage, mise en avant) du « nuage » d'outils/libs,
 *   - sa SOUS-CATÉGORIE `group` (surtout côté DevOps : Conteneurisation, Observabilité,
 *     Sécurité — SAST/DAST/SCA/SBOM, CI/CD…),
 *   - son ICÔNE Devicon locale (`/tech-icons/<slug>.svg`, bundlée, aucune requête réseau)
 *     quand elle existe — sinon repli « initiales » colorées.
 *
 * La correspondance nom → techno est tolérante (sous-chaîne la plus longue), donc les noms
 * verbeux avec versions/parenthèses tombent quand même sur la bonne def. Aucune famille n'a
 * besoin d'être saisie à la main : elle est dérivée du nom (surchargée seulement si l'utilisateur
 * la fixe explicitement dans l'éditeur).
 */

export type TechKind = "language" | "framework" | "library" | "database" | "platform" | "tool" | "concept"

export type TechDef = {
  label: string          // libellé canonique
  keys: string[]         // sous-chaînes normalisées de correspondance (nom + alias)
  family: SkillFamily
  kind: TechKind
  group?: string         // sous-catégorie d'affichage (surtout DevOps)
  color: string          // couleur de marque (accent)
  slug?: string          // présent seulement si une icône Devicon locale existe
  variant?: string       // variante SVG devicon souhaitée (repli automatique sinon)
}

// ── Familles (stockage DB + libellés/couleurs pour l'éditeur) ────────────────
export const SKILL_FAMILIES: { key: SkillFamily; label: string; color: string }[] = [
  { key: "BACKEND",  label: "Backend",  color: "#10b981" },
  { key: "FRONTEND", label: "Frontend", color: "#0ea5e9" },
  { key: "MOBILE",   label: "Mobile",   color: "#14b8a6" },
  { key: "DATABASE", label: "BDD",      color: "#8b5cf6" },
  { key: "DEVOPS",   label: "DevOps",   color: "#f59e0b" },
  { key: "SECURITY", label: "Sécurité", color: "#ef4444" },
  { key: "TOOL",     label: "Outils",   color: "#64748b" },
  { key: "CONCEPT",  label: "Concept",  color: "#ec4899" },
  { key: "OTHER",    label: "Divers",   color: "#6b7280" },
]
export const SKILL_FAMILY_LABEL = Object.fromEntries(SKILL_FAMILIES.map((f) => [f.key, f.label])) as Record<SkillFamily, string>
export const SKILL_FAMILY_COLOR = Object.fromEntries(SKILL_FAMILIES.map((f) => [f.key, f.color])) as Record<SkillFamily, string>

// ── Sections d'affichage (regroupement de haut niveau) ───────────────────────
// Une section agrège une ou plusieurs familles. Sécurité + Outils sont repliés dans DevOps
// (ils y forment des sous-groupes), conformément à la façon dont Pierre pense l'infra.
export type SectionKey = "BACKEND" | "FRONTEND" | "MOBILE" | "DATABASE" | "DEVOPS" | "CONCEPT" | "OTHER"

export const SECTIONS: { key: SectionKey; label: string; color: string; families: SkillFamily[] }[] = [
  { key: "BACKEND",  label: "Backend",           color: "#10b981", families: ["BACKEND"] },
  { key: "FRONTEND", label: "Frontend",          color: "#0ea5e9", families: ["FRONTEND"] },
  { key: "MOBILE",   label: "Mobile",            color: "#14b8a6", families: ["MOBILE"] },
  { key: "DATABASE", label: "Base de données",   color: "#8b5cf6", families: ["DATABASE"] },
  { key: "DEVOPS",   label: "DevOps & Infra",    color: "#f59e0b", families: ["DEVOPS", "SECURITY", "TOOL"] },
  { key: "CONCEPT",  label: "Concepts & méthodo", color: "#ec4899", families: ["CONCEPT"] },
  { key: "OTHER",    label: "Autres",            color: "#6b7280", families: ["OTHER"] },
]

export const FAMILY_TO_SECTION = (() => {
  const m = {} as Record<SkillFamily, SectionKey>
  for (const s of SECTIONS) for (const f of s.families) m[f] = s.key
  return m
})()

// Sous-catégories DevOps : ordre d'affichage + couleur (le rouge signale la sécurité).
const DEVOPS_RED = "#ef4444"
export const GROUP_META: Record<string, { color: string }> = {
  "Conteneurisation":  { color: "#2496ED" },
  "Orchestration":     { color: "#326CE5" },
  "Cloud":             { color: "#f59e0b" },
  "CI/CD":             { color: "#8b5cf6" },
  "Build":             { color: "#64748b" },
  "Observabilité":     { color: "#e6522c" },
  "Tests":             { color: "#22c55e" },
  "Versioning":        { color: "#64748b" },
  "Infra":             { color: "#f59e0b" },
  "Sécurité — SAST":   { color: DEVOPS_RED },
  "Sécurité — DAST":   { color: DEVOPS_RED },
  "Sécurité — SCA":    { color: DEVOPS_RED },
  "Sécurité — SBOM":   { color: DEVOPS_RED },
  "Sécurité":          { color: DEVOPS_RED },
}
export const GROUP_ORDER = [
  "Conteneurisation", "Orchestration", "Cloud", "CI/CD", "Build", "Observabilité",
  "Sécurité — SAST", "Sécurité — DAST", "Sécurité — SCA", "Sécurité — SBOM", "Sécurité",
  "Tests", "Versioning", "Infra",
]

// ── Table des technos ────────────────────────────────────────────────────────
// `keys` = formes normalisées (minuscules, sans séparateurs) reconnues dans un nom.
// L'icône (`slug`) n'est renseignée que si un SVG Devicon existe → sinon repli initiales.
const B = "#10b981", F = "#0ea5e9", D = "#8b5cf6", O = "#f59e0b", RED = "#ef4444", PINK = "#ec4899"

const TECHS: TechDef[] = [
  // ── Langages ──
  { label: "Java",        keys: ["java"],                       family: "BACKEND",  kind: "language", color: "#EA2D2E", slug: "java" },
  { label: "Kotlin",      keys: ["kotlin"],                     family: "BACKEND",  kind: "language", color: "#7F52FF", slug: "kotlin" },
  { label: "Python",      keys: ["python"],                     family: "BACKEND",  kind: "language", color: "#3776AB", slug: "python" },
  { label: "PHP",         keys: ["php"],                        family: "BACKEND",  kind: "language", color: "#777BB4", slug: "php" },
  { label: "Go",          keys: ["golang", "go"],               family: "BACKEND",  kind: "language", color: "#00ACD7", slug: "go" },
  { label: "Rust",        keys: ["rust"],                       family: "BACKEND",  kind: "language", color: "#DE4A22", slug: "rust" },
  { label: "Ruby",        keys: ["ruby"],                       family: "BACKEND",  kind: "language", color: "#CC342D", slug: "ruby" },
  { label: "C#",          keys: ["csharp", "csharp"],           family: "BACKEND",  kind: "language", color: "#68217A", slug: "csharp" },
  { label: "TypeScript",  keys: ["typescript", "ts"],           family: "FRONTEND", kind: "language", color: "#3178C6", slug: "typescript" },
  { label: "JavaScript",  keys: ["javascript", "js"],           family: "FRONTEND", kind: "language", color: "#F7DF1E", slug: "javascript" },

  // ── Frameworks / runtimes back ──
  { label: "Spring Boot", keys: ["springboot", "spring"],       family: "BACKEND",  kind: "framework", color: "#6DB33F", slug: "spring" },
  { label: "Node.js",     keys: ["nodejs", "node"],             family: "BACKEND",  kind: "framework", color: "#5FA04E", slug: "nodejs" },
  { label: "NestJS",      keys: ["nestjs", "nest"],             family: "BACKEND",  kind: "framework", color: "#E0234E", slug: "nestjs" },
  { label: "Express",     keys: ["expressjs", "express"],       family: "BACKEND",  kind: "framework", color: "#444444", slug: "express" },
  { label: "FastAPI",     keys: ["fastapi"],                    family: "BACKEND",  kind: "framework", color: "#009688", slug: "fastapi" },
  { label: "Django",      keys: ["django"],                     family: "BACKEND",  kind: "framework", color: "#0C4B33", slug: "django" },
  { label: "Flask",       keys: ["flask"],                      family: "BACKEND",  kind: "framework", color: "#000000", slug: "flask" },
  { label: "Laravel",     keys: ["laravel"],                    family: "BACKEND",  kind: "framework", color: "#FF2D20", slug: "laravel" },
  { label: "Symfony",     keys: ["symfony"],                    family: "BACKEND",  kind: "framework", color: "#000000", slug: "symfony" },
  { label: ".NET",        keys: ["dotnet", "aspnet"],           family: "BACKEND",  kind: "framework", color: "#512BD4", slug: "dotnetcore" },

  // ── Écosystème Spring (libs) ──
  { label: "Spring Web MVC",       keys: ["springwebmvc", "springmvc", "webmvc"],                        family: "BACKEND", kind: "library", color: "#6DB33F", slug: "spring" },
  { label: "Spring Data JPA",      keys: ["springdatajpahibernate", "springdatajpa", "springdata", "hibernate", "jpa"], family: "BACKEND", kind: "library", color: "#59666C", slug: "hibernate" },
  { label: "Spring Boot Actuator", keys: ["springbootactuator", "actuator"],                             family: "BACKEND", kind: "library", color: "#6DB33F", slug: "spring" },
  { label: "Spring Cloud",         keys: ["springcloud"],                                                family: "BACKEND", kind: "library", color: "#6DB33F", slug: "spring" },
  { label: "Spring Cloud Gateway", keys: ["springcloudgateway", "cloudgateway", "gateway"],              family: "BACKEND", kind: "library", color: "#6DB33F", slug: "spring" },
  { label: "Spring Kafka",         keys: ["springkafka"],                                                family: "BACKEND", kind: "library", color: "#231F20", slug: "apachekafka" },
  { label: "Spring Security",      keys: ["springsecurity"],                                             family: "BACKEND", kind: "library", color: "#6DB33F", slug: "spring" },
  { label: "Eureka",               keys: ["eurekaservicediscovery", "eureka", "servicediscovery"],       family: "BACKEND", kind: "library", color: "#6DB33F" },
  { label: "Resilience4j",         keys: ["resilience4jcircuitbreaker", "resilience4j", "resilience", "circuitbreaker"], family: "BACKEND", kind: "library", color: "#22A699" },
  { label: "Lombok",               keys: ["lombok"],                                                     family: "BACKEND", kind: "library", color: "#BC2D2A" },
  { label: "Apache Kafka",         keys: ["apachekafka", "kafka"],                                       family: "BACKEND", kind: "library", color: "#231F20", slug: "apachekafka" },
  { label: "RabbitMQ",             keys: ["rabbitmq"],                                                   family: "BACKEND", kind: "library", color: "#FF6600", slug: "rabbitmq" },
  { label: "GraphQL",              keys: ["graphql"],                                                    family: "BACKEND", kind: "library", color: "#E10098", slug: "graphql", variant: "plain" },
  { label: "Prisma",               keys: ["prisma"],                                                     family: "BACKEND", kind: "library", color: "#2D3748", slug: "prisma" },

  // ── Frameworks / libs front ──
  { label: "React",       keys: ["reactjs", "react"],           family: "FRONTEND", kind: "framework", color: "#61DAFB", slug: "react" },
  { label: "Next.js",     keys: ["nextjs", "next"],             family: "FRONTEND", kind: "framework", color: "#000000", slug: "nextjs" },
  { label: "Vue.js",      keys: ["vuejs", "vue"],               family: "FRONTEND", kind: "framework", color: "#4FC08D", slug: "vuejs" },
  { label: "Angular",     keys: ["angular"],                    family: "FRONTEND", kind: "framework", color: "#DD0031", slug: "angular" },
  { label: "Svelte",      keys: ["sveltekit", "svelte"],        family: "FRONTEND", kind: "framework", color: "#FF3E00", slug: "svelte" },
  { label: "Astro",       keys: ["astro"],                      family: "FRONTEND", kind: "framework", color: "#FF5D01", slug: "astro" },
  { label: "Tailwind CSS", keys: ["tailwindcss", "tailwind"],   family: "FRONTEND", kind: "library", color: "#38BDF8", slug: "tailwindcss" },
  { label: "Chakra UI",   keys: ["chakraui", "chakra"],         family: "FRONTEND", kind: "library", color: "#319795", slug: "chakraui" },
  { label: "Bootstrap",   keys: ["bootstrap"],                  family: "FRONTEND", kind: "library", color: "#7952B3", slug: "bootstrap" },
  { label: "Sass",        keys: ["sass", "scss"],               family: "FRONTEND", kind: "library", color: "#CC6699", slug: "sass" },
  { label: "Redux",       keys: ["redux"],                      family: "FRONTEND", kind: "library", color: "#764ABC", slug: "redux" },
  { label: "HTML5",       keys: ["html5", "html"],              family: "FRONTEND", kind: "library", color: "#E34F26", slug: "html5" },
  { label: "CSS3",        keys: ["css3", "css"],                family: "FRONTEND", kind: "library", color: "#1572B6", slug: "css3" },

  // ── Mobile ──
  { label: "Capacitor",   keys: ["capacitorjs", "capacitor"],   family: "MOBILE",   kind: "framework", color: "#119EFF", slug: "capacitor" },
  { label: "Flutter",     keys: ["flutter"],                    family: "MOBILE",   kind: "framework", color: "#02569B", slug: "flutter" },
  { label: "React Native", keys: ["reactnative"],               family: "MOBILE",   kind: "framework", color: "#61DAFB", slug: "react" },
  { label: "Firebase",    keys: ["firebase"],                   family: "MOBILE",   kind: "platform", color: "#FFCA28", slug: "firebase", variant: "plain" },

  // ── Bases de données ──
  { label: "PostgreSQL",  keys: ["postgresql", "postgres"],     family: "DATABASE", kind: "database", color: "#336791", slug: "postgresql" },
  { label: "MySQL",       keys: ["mysql"],                      family: "DATABASE", kind: "database", color: "#4479A1", slug: "mysql" },
  { label: "MongoDB",     keys: ["mongodb", "mongo"],           family: "DATABASE", kind: "database", color: "#47A248", slug: "mongodb" },
  { label: "Redis",       keys: ["redis"],                      family: "DATABASE", kind: "database", color: "#DC382D", slug: "redis" },
  { label: "SQLite",      keys: ["sqlite"],                     family: "DATABASE", kind: "database", color: "#003B57", slug: "sqlite" },
  { label: "Elasticsearch", keys: ["elasticsearch", "elastic"], family: "DATABASE", kind: "database", color: "#005571", slug: "elasticsearch" },

  // ── DevOps : conteneurisation / orchestration ──
  { label: "Docker",         keys: ["docker"],                          family: "DEVOPS", kind: "platform", group: "Conteneurisation", color: "#2496ED", slug: "docker" },
  { label: "Docker Compose", keys: ["dockercompose", "compose"],        family: "DEVOPS", kind: "tool",     group: "Conteneurisation", color: "#2496ED", slug: "docker" },
  { label: "Docker Swarm",   keys: ["dockerswarm", "swarm"],            family: "DEVOPS", kind: "tool",     group: "Orchestration",    color: "#2496ED", slug: "docker" },
  { label: "Kubernetes",     keys: ["kubernetes", "k8s", "kube"],       family: "DEVOPS", kind: "platform", group: "Orchestration",    color: "#326CE5", slug: "kubernetes" },
  { label: "Helm",           keys: ["helm"],                            family: "DEVOPS", kind: "tool",     group: "Orchestration",    color: "#0F1689", slug: "helm" },
  // ── DevOps : cloud / infra ──
  { label: "AWS",         keys: ["aws", "amazonwebservices"],           family: "DEVOPS", kind: "platform", group: "Cloud", color: "#FF9900", slug: "amazonwebservices" },
  { label: "Google Cloud", keys: ["googlecloud", "gcp"],                family: "DEVOPS", kind: "platform", group: "Cloud", color: "#4285F4", slug: "googlecloud" },
  { label: "Vercel",      keys: ["vercel"],                             family: "DEVOPS", kind: "platform", group: "Cloud", color: "#000000", slug: "vercel" },
  { label: "Nginx",       keys: ["nginx"],                              family: "DEVOPS", kind: "tool",     group: "Infra", color: "#009639", slug: "nginx" },
  { label: "Terraform",   keys: ["terraform"],                          family: "DEVOPS", kind: "tool",     group: "Infra", color: "#7B42BC", slug: "terraform" },
  { label: "Ansible",     keys: ["ansible"],                            family: "DEVOPS", kind: "tool",     group: "Infra", color: "#000000", slug: "ansible" },
  { label: "Linux",       keys: ["linux"],                              family: "DEVOPS", kind: "platform", group: "Infra", color: "#FCC624", slug: "linux" },
  // ── DevOps : CI/CD ──
  { label: "GitHub Actions", keys: ["githubactionscicd", "githubactions", "ghactions"], family: "DEVOPS", kind: "tool", group: "CI/CD", color: "#2088FF", slug: "githubactions" },
  { label: "GitLab CI",   keys: ["gitlabci", "gitlab"],                 family: "DEVOPS", kind: "tool",     group: "CI/CD", color: "#FC6D26", slug: "gitlab" },
  { label: "Jenkins",     keys: ["jenkins"],                            family: "DEVOPS", kind: "tool",     group: "CI/CD", color: "#D24939", slug: "jenkins" },
  { label: "DevSecOps",   keys: ["devsecopscicd", "devsecops"],         family: "DEVOPS", kind: "concept",  group: "CI/CD", color: O },
  // ── DevOps : build ──
  { label: "Maven",       keys: ["apachemaven", "maven"],               family: "DEVOPS", kind: "tool",     group: "Build", color: "#C71A36", slug: "maven" },
  { label: "Gradle",      keys: ["gradle"],                             family: "DEVOPS", kind: "tool",     group: "Build", color: "#02303A", slug: "gradle" },
  // ── DevOps : observabilité ──
  { label: "Prometheus",  keys: ["prometheus"],                         family: "DEVOPS", kind: "tool",     group: "Observabilité", color: "#E6522C", slug: "prometheus" },
  { label: "Grafana",     keys: ["grafana"],                            family: "DEVOPS", kind: "tool",     group: "Observabilité", color: "#F46800", slug: "grafana" },
  { label: "Micrometer",  keys: ["micrometer"],                         family: "DEVOPS", kind: "tool",     group: "Observabilité", color: "#117A96" },
  { label: "Kibana",      keys: ["kibana"],                             family: "DEVOPS", kind: "tool",     group: "Observabilité", color: "#005571", slug: "kibana" },
  // ── DevOps : tests ──
  { label: "Vitest",      keys: ["vitest"],                             family: "DEVOPS", kind: "tool",     group: "Tests", color: "#6E9F18", slug: "vitest" },
  { label: "Jest",        keys: ["jest"],                               family: "DEVOPS", kind: "tool",     group: "Tests", color: "#C21325", slug: "jest", variant: "plain" },
  { label: "JUnit",       keys: ["junit"],                              family: "DEVOPS", kind: "tool",     group: "Tests", color: "#25A162", slug: "junit" },
  { label: "Playwright",  keys: ["playwright"],                         family: "DEVOPS", kind: "tool",     group: "Tests", color: "#2EAD33" },
  { label: "Cypress",     keys: ["cypress"],                            family: "DEVOPS", kind: "tool",     group: "Tests", color: "#17202C" },
  // ── DevOps : versioning ──
  { label: "Git",         keys: ["git"],                                family: "DEVOPS", kind: "tool",     group: "Versioning", color: "#F05032", slug: "git" },
  { label: "GitHub",      keys: ["github"],                             family: "DEVOPS", kind: "tool",     group: "Versioning", color: "#181717", slug: "github" },
  // ── DevOps : sécurité (SAST / DAST / SCA / SBOM) ──
  { label: "SpotBugs + FindSecBugs", keys: ["spotbugsfindsecbugssast", "spotbugs", "findsecbugs"], family: "DEVOPS", kind: "tool", group: "Sécurité — SAST", color: RED },
  { label: "CodeQL",      keys: ["codeql"],                             family: "DEVOPS", kind: "tool", group: "Sécurité — SAST", color: RED },
  { label: "SonarQube",   keys: ["sonarqube", "sonar"],                 family: "DEVOPS", kind: "tool", group: "Sécurité — SAST", color: "#4E9BCD", slug: "sonarqube" },
  { label: "Semgrep",     keys: ["semgrep"],                            family: "DEVOPS", kind: "tool", group: "Sécurité — SAST", color: RED },
  { label: "OWASP ZAP",   keys: ["owaspzapdast", "owaspzap", "zap"],    family: "DEVOPS", kind: "tool", group: "Sécurité — DAST", color: RED },
  { label: "OWASP Dependency-Check", keys: ["owaspdependencychecksca", "dependencycheck"], family: "DEVOPS", kind: "tool", group: "Sécurité — SCA", color: RED },
  { label: "Trivy",       keys: ["trivyscanconteneur", "trivy"],        family: "DEVOPS", kind: "tool", group: "Sécurité — SCA", color: RED },
  { label: "Snyk",        keys: ["snyk"],                               family: "DEVOPS", kind: "tool", group: "Sécurité — SCA", color: RED },
  { label: "CycloneDX",   keys: ["cyclonedxsbom", "cyclonedx", "sbom"], family: "DEVOPS", kind: "tool", group: "Sécurité — SBOM", color: RED },
  // ── Outils divers ──
  { label: "Postman",     keys: ["postman"],                            family: "DEVOPS", kind: "tool", group: "Outillage", color: "#FF6C37", slug: "postman" },
  { label: "Swagger",     keys: ["swagger", "openapi"],                 family: "DEVOPS", kind: "tool", group: "Outillage", color: "#85EA2D", slug: "swagger" },
  { label: "Figma",       keys: ["figma"],                              family: "TOOL",   kind: "tool", color: "#F24E1E", slug: "figma" },

  // ── Concepts / archi / méthodo ──
  { label: "Architecture microservices", keys: ["architecturemicroservices", "microservices", "microservice"], family: "CONCEPT", kind: "concept", color: PINK },
  { label: "Event-Driven Architecture",  keys: ["eventdrivenarchitecture", "eventdriven"],                     family: "CONCEPT", kind: "concept", color: PINK },
  { label: "Clean Architecture",         keys: ["cleanarchitecture", "hexagonal"],                             family: "CONCEPT", kind: "concept", color: PINK },
  { label: "DDD",                        keys: ["domaindrivendesign", "ddd"],                                  family: "CONCEPT", kind: "concept", color: PINK },
  { label: "YAGNI",                      keys: ["yagni"],                                                      family: "CONCEPT", kind: "concept", color: PINK },
  { label: "SOLID",                      keys: ["solid"],                                                      family: "CONCEPT", kind: "concept", color: PINK },
]

// Indices de famille pour des mots-clés génériques (dernier recours, sans icône).
// Ordonnés du plus spécifique au plus générique.
const RULES: { keys: string[]; family: SkillFamily; kind: TechKind; group?: string; color: string }[] = [
  { keys: ["sast"],                 family: "DEVOPS", kind: "tool", group: "Sécurité — SAST", color: RED },
  { keys: ["dast"],                 family: "DEVOPS", kind: "tool", group: "Sécurité — DAST", color: RED },
  { keys: ["sbom"],                 family: "DEVOPS", kind: "tool", group: "Sécurité — SBOM", color: RED },
  { keys: ["sca"],                  family: "DEVOPS", kind: "tool", group: "Sécurité — SCA", color: RED },
  { keys: ["securite", "security", "owasp", "pentest", "vulnerab"], family: "DEVOPS", kind: "tool", group: "Sécurité", color: RED },
  { keys: ["cicd", "pipeline"],     family: "DEVOPS", kind: "tool", group: "CI/CD", color: O },
  { keys: ["observab", "monitoring", "metrics"], family: "DEVOPS", kind: "tool", group: "Observabilité", color: O },
  { keys: ["orchestration"],        family: "DEVOPS", kind: "tool", group: "Orchestration", color: O },
  { keys: ["conteneur", "container"], family: "DEVOPS", kind: "tool", group: "Conteneurisation", color: O },
  { keys: ["migration"],            family: "CONCEPT", kind: "concept", color: PINK },
  { keys: ["architecture", "pattern", "methodo"], family: "CONCEPT", kind: "concept", color: PINK },
  { keys: ["frontend", "front"],    family: "FRONTEND", kind: "library", color: F },
  { keys: ["backend", "back"],      family: "BACKEND",  kind: "library", color: B },
  { keys: ["database", "basededonnees", "bdd"], family: "DATABASE", kind: "database", color: D },
  { keys: ["test"],                 family: "DEVOPS", kind: "tool", group: "Tests", color: "#22c55e" },
]

export function normalizeTech(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "")
}

// ── Correspondance nom → def (exacte, sinon sous-chaîne la plus longue) ───────
function matchTech(name: string): TechDef | null {
  const n = normalizeTech(name)
  if (!n) return null
  // 1) une clé strictement égale (priorité absolue)
  for (const t of TECHS) if (t.keys.includes(n)) return t
  // 2) sinon la def dont une clé (≥ 3 car.) est contenue dans le nom, la plus longue gagne
  let best: TechDef | null = null
  let bestLen = 0
  for (const t of TECHS) {
    for (const k of t.keys) {
      if (k.length >= 3 && k.length > bestLen && n.includes(k)) { best = t; bestLen = k.length }
    }
  }
  return best
}

/** Résout une techno (par nom/alias/sous-chaîne) vers sa def, ou null. */
export function resolveTech(name: string): TechDef | null {
  return matchTech(name)
}

export type Classification = { family: SkillFamily; kind: TechKind; group?: string; color: string; tech: TechDef | null }

/** Classe un nom de compétence : famille + kind + sous-catégorie + couleur (auto, sans saisie). */
export function classifyTech(name: string): Classification {
  const n = normalizeTech(name)
  const t = matchTech(name)
  // Surcharge « tâche/notion » : un « Migration <techno> » est un concept, pas un item de
  // stack — on garde l'icône de la techno citée mais on le classe en Concepts.
  if (n.includes("migration")) return { family: "CONCEPT", kind: "concept", color: PINK, tech: t }
  if (t) return { family: t.family, kind: t.kind, group: t.group, color: t.color, tech: t }
  for (const r of RULES) if (r.keys.some((k) => n.includes(k))) return { family: r.family, kind: r.kind, group: r.group, color: r.color, tech: null }
  return { family: "OTHER", kind: "library", color: SKILL_FAMILY_COLOR.OTHER, tech: null }
}

/** Famille suggérée pour un nom (auto) — utilisée à la création côté serveur. null si indéterminée. */
export function suggestFamily(name: string): SkillFamily | null {
  const c = classifyTech(name)
  // Repli pur « OTHER sans reconnaissance » → on laisse la famille vide côté DB.
  if (!c.tech && c.family === "OTHER") return null
  return c.family
}

/** true si la techno est de la « stack principale » (langage / framework / moteur BDD). */
export function isPrimaryKind(kind: TechKind): boolean {
  return kind === "language" || kind === "framework" || kind === "database"
}

// Poids d'ordre des primaires (framework d'abord, puis langage, puis moteur BDD).
export const PRIMARY_ORDER: Record<TechKind, number> = {
  framework: 0, language: 1, database: 2, platform: 3, library: 4, tool: 5, concept: 6,
}

// Suggestions pour l'autocomplétion du champ d'ajout (technos courantes, libellés propres).
export const SUGGESTED_TECHS: string[] = Array.from(new Set(TECHS.map((t) => t.label))).sort((a, b) => a.localeCompare(b, "fr"))

/** Toutes les defs ayant une icône (pour le script de génération des SVG). */
export const ALL_TECHS = TECHS
