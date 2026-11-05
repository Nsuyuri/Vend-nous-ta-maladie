// ===========================================================
// panier-utils.js — gestion du panier en localStorage
// Le panier est propre à cet appareil/navigateur, pas au compte.
// ===========================================================

const CLE_PANIER = "panier_vend_nous_ta_maladie";

export function recupererPanier() {
  try {
    const brut = localStorage.getItem(CLE_PANIER);
    const liste = brut ? JSON.parse(brut) : [];
    // On ignore les anciens produits (identifiants d'avant la migration)
    return liste.filter((p) => /^[0-9a-f-]{36}$/i.test(String(p.produitId || "")));
  } catch {
    return [];
  }
}

export function sauvegarderPanier(panier) {
  localStorage.setItem(CLE_PANIER, JSON.stringify(panier));
  window.dispatchEvent(new Event("panier-maj")); // met à jour la pastille du panier
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
  window.dispatchEvent(new Event("panier-maj"));
}

export function compterArticlesPanier() {
  return recupererPanier().reduce((total, p) => total + p.quantite, 0);
}
