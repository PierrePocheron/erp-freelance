import type { NextAuthConfig } from "next-auth"
import Google from "next-auth/providers/google"

export const authConfig: NextAuthConfig = {
  providers: [Google],
  pages: { signIn: "/login" },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const isAuthPage = nextUrl.pathname.startsWith("/login")
      if (!isLoggedIn && !isAuthPage) {
        return Response.redirect(new URL("/login", nextUrl))
      }
      return true
    },
  },
}
