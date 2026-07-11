// Script inline exécuté en tout premier (streamé dans le HTML initial, hors
// arbre React — voir src/app/layout.tsx) pour appliquer la classe .dark sans
// flash (FOUC), avant l'hydratation.
export const THEME_INIT_SCRIPT =
  "(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(t===null&&window.matchMedia('(prefers-color-scheme:dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})()"

// Hash CSP du script ci-dessus — autorisé dans script-src (src/proxy.ts) à la
// place d'un nonce : le script est statique, un hash suffit et évite toute
// interpolation par requête (source historique de mismatchs d'hydratation).
// Régénérer si le script change (le test unitaire theme-init-script.test.ts
// casse sinon) :
//   npx tsx -e "import{createHash}from'node:crypto';import{THEME_INIT_SCRIPT}from'./src/lib/theme-init-script';console.log('sha256-'+createHash('sha256').update(THEME_INIT_SCRIPT).digest('base64'))"
export const THEME_INIT_SCRIPT_HASH = "sha256-4ZL0/Isl0Re3iZNnJPyj2WzyqZq4cdGJruf6dTAdxRo="
