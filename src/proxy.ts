import NextAuth from "next-auth"
import { NextResponse } from "next/server"
import { authConfig } from "@/auth.config"
import { THEME_INIT_SCRIPT_HASH } from "@/lib/theme-init-script"

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
    // Le hash autorise le script de thème inline statique (hors arbre React,
    // cf. layout.tsx) — les hashes restent honorés avec 'strict-dynamic'.
    `script-src 'self' 'nonce-${nonce}' '${THEME_INIT_SCRIPT_HASH}' 'strict-dynamic' 'unsafe-eval'`,
    // Service worker (/sw.js, push) — sans cette directive, strict-dynamic
    // le bloquerait (un SW chargé par URL ne porte pas de nonce)
    "worker-src 'self'",
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
