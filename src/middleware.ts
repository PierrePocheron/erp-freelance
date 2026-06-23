import NextAuth from "next-auth"
import { NextResponse } from "next/server"
import { authConfig } from "@/auth.config"

// Instance edge-safe (authConfig ne charge ni Prisma ni adapter).
const { auth } = NextAuth(authConfig)

/**
 * Middleware :
 *  1. Protection d'authentification en défense en profondeur (le layout (app)
 *     garde déjà les pages, mais on bloque aussi en amont).
 *  2. Content-Security-Policy par nonce : un nonce unique est généré par requête,
 *     injecté dans l'en-tête CSP et transmis au rendu (x-nonce) pour autoriser
 *     les scripts inline légitimes sans 'unsafe-inline'.
 */
export default auth((req) => {
  const isLoggedIn = !!req.auth
  const isAuthPage = req.nextUrl.pathname.startsWith("/login")

  // Redirections d'auth
  if (!isLoggedIn && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", req.nextUrl.origin))
  }
  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL("/", req.nextUrl.origin))
  }

  // Nonce CSP (base64 d'un UUID aléatoire) — btoa est dispo dans l'edge runtime.
  const nonce = btoa(crypto.randomUUID())
  const csp = [
    "default-src 'self'",
    // 'strict-dynamic' + nonce remplacent 'unsafe-inline' pour les scripts.
    // 'unsafe-eval' conservé par prudence (certaines libs client l'exigent).
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data: https:",
    "font-src 'self'",
    "connect-src 'self' https://api.resend.com https://blob.vercel-storage.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ")

  const requestHeaders = new Headers(req.headers)
  requestHeaders.set("x-nonce", nonce)
  requestHeaders.set("content-security-policy", csp)

  const res = NextResponse.next({ request: { headers: requestHeaders } })
  res.headers.set("content-security-policy", csp)
  return res
})

export const config = {
  // Exécute le middleware sur les pages uniquement : on exclut les routes API
  // (qui s'auto-protègent et renvoient du JSON 401, pas une redirection) et les
  // assets statiques.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
}
