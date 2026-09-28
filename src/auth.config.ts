import type { NextAuthConfig } from "next-auth"
import Google from "next-auth/providers/google"
import { isEmailAllowed } from "@/lib/auth-allowlist"

export const authConfig: NextAuthConfig = {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  pages: { signIn: "/login" },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      // Session JWT : un jeton émis avant la mise en place de la liste blanche
      // resterait valide jusqu'à son expiration. On revalide donc l'email à
      // chaque requête — un compte retiré de la liste est traité comme déconnecté.
      const isLoggedIn = !!auth?.user && isEmailAllowed(auth.user.email, process.env.AUTH_ALLOWED_EMAILS)
      const isAuthPage = nextUrl.pathname.startsWith("/login")

      if (isLoggedIn && isAuthPage) {
        return Response.redirect(new URL("/", nextUrl))
      }
      if (!isLoggedIn && !isAuthPage) {
        return Response.redirect(new URL("/login", nextUrl))
      }
      return true
    },
  },
}
