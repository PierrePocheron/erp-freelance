// Script inline exécuté en tout premier (streamé dans le HTML initial, hors
// arbre React — voir src/app/layout.tsx), jumeau de theme-init-script.ts mais
// pour le masquage des montants : applique la classe .hide-amounts sur <html>
// AVANT hydratation si l'utilisateur l'avait activé, de sorte qu'à la toute
// première peinture l'état soit déjà correct (pas de flash des vrais montants
// avant une capture, et surtout : l'état React du bouton et la classe du DOM ne
// peuvent plus diverger — cf. bug « le bouton ne masque/démasque plus rien »).
export const AMOUNTS_INIT_SCRIPT =
  "(function(){try{if(localStorage.getItem('erp-hide-amounts')==='1'){document.documentElement.classList.add('hide-amounts')}}catch(e){}})()"

// Hash CSP du script ci-dessus — autorisé dans script-src (src/proxy.ts) au même
// titre que le script de thème. Régénérer si le script change :
//   npx tsx -e "import{createHash}from'node:crypto';import{AMOUNTS_INIT_SCRIPT}from'./src/lib/amounts-init-script';console.log('sha256-'+createHash('sha256').update(AMOUNTS_INIT_SCRIPT).digest('base64'))"
export const AMOUNTS_INIT_SCRIPT_HASH = "sha256-2En4K+I7YAmE0e7UrzXyRFYltCr6kC2ptvG6hNjKUDI="
