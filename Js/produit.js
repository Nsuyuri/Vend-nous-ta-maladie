// ===========================================================
// produit.js — page produit.html
// ===========================================================

import { db } from "./firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { ajouterAuPanier, compterArticlesPanier } from "./panier-utils.js";

const parametres = new URLSearchParams(window.location.search);
const idProduit = parametres.get("id");
const conteneur = document.getElementById("fiche-produit");
const messageZone = document.getElementById("message-produit-page");

document.getElementById("lien-panier").textContent = `Panier (${compterArticlesPanier()})`;

function echapper(texte) {
  return String(texte ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function afficherProduit() {
  try {
    await chargerProduit();
  } catch (err) {
    console.error("Erreur page produit :", err);
    messageZone.innerHTML = `<div class="message erreur">Impossible d'afficher ce produit${err.code === "permission-denied" ? " (accès refusé par les règles Firestore)" : ""}.</div>`;
  }
}

async function chargerProduit() {
  if (!idProduit) {
    messageZone.innerHTML = `<div class="message erreur">Produit introuvable.</div>`;
    return;
  }

  const snap = await getDoc(doc(db, "produits", idProduit));
  if (!snap.exists()) {
    messageZone.innerHTML = `<div class="message erreur">Ce produit n'existe plus.</div>`;
    return;
  }

  const produit = snap.data();
  conteneur.innerHTML = `
    <img src="${echapper(produit.imageUrl)}" alt="${echapper(produit.nom)}">
    <div>
      <h1>${echapper(produit.nom)}</h1>
      <p class="prix">${Number(produit.prix || 0).toLocaleString("fr-FR")} FCFA</p>
      <p style="color:var(--texte-doux); margin-bottom:14px;">Vendu par ${echapper(produit.vendeurNom)}</p>
      <p>${echapper(produit.description)}</p>
      <button class="bouton" id="bouton-ajouter-panier" style="margin-top:20px;">Ajouter au panier</button>
    </div>
  `;

  document.getElementById("bouton-ajouter-panier").addEventListener("click", () => {
    ajouterAuPanier({
      produitId: idProduit,
      nom: produit.nom,
      prix: produit.prix,
      imageUrl: produit.imageUrl,
      vendeurUid: produit.vendeurUid,
      vendeurNom: produit.vendeurNom
    });
    document.getElementById("lien-panier").textContent = `Panier (${compterArticlesPanier()})`;
    messageZone.innerHTML = `<div class="message succes">Produit ajouté au panier.</div>`;
  });
}

afficherProduit();
