import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import { authConfig } from "@/auth.config"

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  callbacks: {
    jwt({ token, user }) {
      if (user) token.id = user.id
      return token
    },
    session({ session, token }) {
      session.user.id = token.id as string
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
