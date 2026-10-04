// ===========================================================
// panier-utils.js — gestion du panier en localStorage
// Le panier est propre à cet appareil/navigateur, pas au compte.
// ===========================================================

const CLE_PANIER = "panier_vend_nous_ta_maladie";

export function recupererPanier() {
  const brut = localStorage.getItem(CLE_PANIER);
  return brut ? JSON.parse(brut) : [];
}

export function sauvegarderPanier(panier) {
  localStorage.setItem(CLE_PANIER, JSON.stringify(panier));
}

export function ajouterAuPanier(produit) {
  const panier = recupererPanier();
  const existant = panier.find((p) => p.produitId === produit.produitId);
  if (existant) {
    existant.quantite += 1;
  } else {
    panier.push({ ...produit, quantite: 1 });
  }
  sauvegarderPanier(panier);
}

export function viderPanier() {
  localStorage.removeItem(CLE_PANIER);
}

export function compterArticlesPanier() {
  return recupererPanier().reduce((total, p) => total + p.quantite, 0);
}
