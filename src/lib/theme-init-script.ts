// Script inline exécuté en tout premier dans <body>, avant l'hydratation, pour
// appliquer la classe .dark sans flash (FOUC). Contenu 100% statique (jamais
// interpolé) → autorisé en CSP via un hash sha256 plutôt qu'un nonce, ce qui
// évite le mismatch d'hydratation React sur l'attribut `nonce` (le navigateur
// vide volontairement cet attribut côté client une fois le script inséré).
// Si ce texte change, régénérer le hash CSP dans le script-src de src/proxy.ts
// (cf. commentaire juste au-dessus, dans la même liste csp).
export const THEME_INIT_SCRIPT =
  "(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(t===null&&window.matchMedia('(prefers-color-scheme:dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})()"
