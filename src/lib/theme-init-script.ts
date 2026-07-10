// Script inline exécuté en tout premier via next/script (beforeInteractive)
// pour appliquer la classe .dark sans flash (FOUC), avant l'hydratation.
// Extrait ici pour être réutilisé tel quel dans src/app/layout.tsx.
export const THEME_INIT_SCRIPT =
  "(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(t===null&&window.matchMedia('(prefers-color-scheme:dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})()"
