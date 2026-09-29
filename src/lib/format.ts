// Formatage des montants — UN seul endroit (#44). Il y avait une douzaine de copies locales
// aux sorties divergentes (« 1 234,5 € », « 1 235 € », « 1 234,50 € » sur la même page).
//
//  amount2 / eur2     : toujours 2 décimales — documents, lignes, paiements, dialogues
//  amount0 / eur0     : arrondi à l'euro — cartes et totaux de tableau de bord
//  amountAuto/eurAuto : entier sans décimales, sinon 2 (listes : 1 200 € / 1 234,50 €)
//
// Le zéro est normalisé (un résidu flottant -0,004 affichait « -0,00 »). L'espace avant « € »
// est insécable : le symbole ne passe jamais seul à la ligne. Les PDF gardent leur propre
// formateur (lib/pdf.tsx : la police Poppins n'a pas le glyphe des séparateurs Intl).

const EUR = " €"

const clean = (n: number, decimals: number) => {
  const f = 10 ** decimals
  return Math.round((Number.isFinite(n) ? n : 0) * f) / f || 0
}

export const amount2 = (n: number) =>
  clean(n, 2).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const amount0 = (n: number) =>
  clean(n, 0).toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })

export const amountAuto = (n: number) => {
  const v = clean(n, 2)
  return Number.isInteger(v) ? amount0(v) : amount2(v)
}

export const eur2 = (n: number) => amount2(n) + EUR
export const eur0 = (n: number) => amount0(n) + EUR
export const eurAuto = (n: number) => amountAuto(n) + EUR
