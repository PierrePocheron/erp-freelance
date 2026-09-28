import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import { authConfig } from "@/auth.config"
import { hasAllowlist, isEmailAllowed } from "@/lib/auth-allowlist"

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  callbacks: {
    // Porte d'entrée de l'app (déployée publiquement) : seuls les emails de
    // AUTH_ALLOWED_EMAILS peuvent se connecter. Si la variable est absente, on
    // refuse au moins toute NOUVELLE inscription — les comptes déjà en base
    // continuent d'entrer, pour qu'un oubli de variable ne verrouille pas le
    // propriétaire. Retourner false → redirection /login?error=AccessDenied.
    async signIn({ user }) {
      const raw = process.env.AUTH_ALLOWED_EMAILS
      const email = user.email?.trim().toLowerCase()
      if (!email) return false
      if (hasAllowlist(raw)) return isEmailAllowed(email, raw)
      const known = await prisma.user.findUnique({ where: { email }, select: { id: true } })
      return known !== null
    },
    jwt({ token, user }) {
      if (user) token.id = user.id
      return token
    },
    session({ session, token }) {
      // token.id peut être absent (token hérité sans passage par le callback jwt) :
      // on n'assigne que si c'est bien une chaîne, plutôt qu'un undefined typé string.
      if (typeof token.id === "string") session.user.id = token.id
      return session
    },
  },
  events: {
    // Le PrismaAdapter n'écrit les tokens/scope qu'au PREMIER linkAccount.
    // Lors d'une ré-autorisation (ex: autorisation incrémentale Google Agenda),
    // il ne met PAS à jour la ligne Account → le nouveau scope et le refresh_token
    // sont perdus. On les persiste donc manuellement à chaque connexion Google.
    async signIn({ account }) {
      if (account?.provider !== "google") return
      await prisma.account.updateMany({
        where: { provider: "google", providerAccountId: account.providerAccountId },
        data: {
          access_token: account.access_token,
          expires_at: account.expires_at,
          scope: account.scope,
          token_type: account.token_type,
          id_token: account.id_token,
          // refresh_token uniquement si Google en renvoie un nouveau
          // (présent avec prompt=consent + access_type=offline)
          ...(account.refresh_token ? { refresh_token: account.refresh_token } : {}),
        },
      })
    },
  },
})

/**
 * Session d'une route `/api/**` — à utiliser à la place de `auth()` dans ces
 * routes.
 *
 * Le proxy edge revalide la liste blanche à chaque requête, mais son matcher
 * EXCLUT `/api` : sans ce garde, un jeton déjà émis gardait l'accès aux exports,
 * aux PDF et à l'upload pendant toute sa durée de vie (30 jours) après le retrait
 * de son email de `AUTH_ALLOWED_EMAILS`. Renvoie null s'il n'y a pas de session
 * utilisable — l'appelant répond 401.
 */
export async function apiSession(): Promise<{ user: { id: string; email?: string | null } } | null> {
  const session = await auth()
  const id = session?.user?.id
  if (!id) return null
  if (!isEmailAllowed(session.user.email, process.env.AUTH_ALLOWED_EMAILS)) return null
  return { user: { id, email: session.user.email } }
}
