import NextAuth from "next-auth"
import { NextResponse } from "next/server"
import { authConfig } from "@/auth.config"

const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const isAuthPage = req.nextUrl.pathname.startsWith("/login")

  if (!isLoggedIn && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", req.nextUrl.origin))
  }
  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL("/", req.nextUrl.origin))
  }

  const nonce = btoa(crypto.randomUUID())
  const csp = [
    "default-src 'self'",
    // Le hash correspond au script inline theme-init de src/app/layout.tsx (contenu
    // statique, jamais interpolé) — un hash plutôt qu'un nonce pour ce script précis
    // évite le mismatch d'hydratation React sur l'attribut `nonce` (le navigateur le
    // vide côté client une fois le <script> inséré). Si src/lib/theme-init-script.ts
    // change, copier le nouveau texte (celui exporté par THEME_INIT_SCRIPT) dans la
    // commande ci-dessous à la place de <script> puis régénérer :
    //   node -e "console.log('sha256-'+require('crypto').createHash('sha256').update(\`<script>\`,'utf8').digest('base64'))"
    `script-src 'self' 'nonce-${nonce}' 'sha256-4ZL0/Isl0Re3iZNnJPyj2WzyqZq4cdGJruf6dTAdxRo=' 'strict-dynamic' 'unsafe-eval'`,
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
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
}
