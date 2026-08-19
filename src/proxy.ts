import NextAuth from "next-auth"
import { NextResponse } from "next/server"
import { authConfig } from "@/auth.config"
import { THEME_INIT_SCRIPT_HASH } from "@/lib/theme-init-script"
import { AMOUNTS_INIT_SCRIPT_HASH } from "@/lib/amounts-init-script"

const { auth } = NextAuth(authConfig)

export default auth((req) => {
  // Les redirections d'auth (login ↔ pages protégées) sont l'unique responsabilité
  // du callback `authorized` de auth.config.ts : next-auth l'exécute AVANT ce corps
  // et, quand il renvoie un Response.redirect, ce middleware n'est PAS appelé. Ce
  // corps ne s'exécute donc que sur les requêtes déjà autorisées — il se limite à
  // poser les en-têtes CSP/nonce.
  const nonce = btoa(crypto.randomUUID())
  const csp = [
    "default-src 'self'",
    // Les hashes autorisent les scripts inline statiques (thème + masquage des
    // montants, hors arbre React, cf. layout.tsx) — honorés avec 'strict-dynamic'.
    // 'unsafe-eval' : requis par le HMR / Fast Refresh de Next.js en dev (eval).
    // La même CSP est servie en prod, où l'App Router n'en a normalement pas besoin :
    // durcissement possible (retrait en prod) à valider avant de l'appliquer.
    `script-src 'self' 'nonce-${nonce}' '${THEME_INIT_SCRIPT_HASH}' '${AMOUNTS_INIT_SCRIPT_HASH}' 'strict-dynamic' 'unsafe-eval'`,
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
