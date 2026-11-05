// ===========================================================
// panier.js — page panier.html
// ===========================================================

import { auth, envoyerCommande, estRefuse } from "./supabase-config.js";
import { recupererProfil } from "./auth.js";
import { optimiserImage } from "./outils.js";
import {
  recupererPanier, sauvegarderPanier, viderPanier, compterArticlesPanier
} from "./panier-utils.js";

const listeConteneur = document.getElementById("liste-panier");
const totalConteneur = document.getElementById("total-panier");
const messageZone = document.getElementById("message-panier");
const formCommande = document.getElementById("form-commande");
const blocCommande = document.getElementById("bloc-commande");
const boutonContinuer = document.getElementById("bouton-continuer");
const boutonRetour = document.getElementById("bouton-retour");
const indicateur = document.getElementById("indicateur-etape");

// Étape 1 : le panier — Étape 2 : la livraison
let etape = 1;

function mettreAJourEtape() {
  indicateur.style.display = "block";
  indicateur.textContent = etape === 1 ? "Étape 1 sur 2 — Mon panier" : "Étape 2 sur 2 — Livraison";
  boutonContinuer.style.display = etape === 1 ? "inline-block" : "none";
  blocCommande.style.display = etape === 2 ? "block" : "none";
}

function echapper(texte) {
  return String(texte ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

boutonContinuer.addEventListener("click", () => {
  etape = 2;
  mettreAJourEtape();
  blocCommande.scrollIntoView({ behavior: "smooth" });
});

boutonRetour.addEventListener("click", () => {
  etape = 1;
  mettreAJourEtape();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

function afficherPanier() {
  const panier = recupererPanier();

  if (panier.length === 0) {
    listeConteneur.innerHTML = `<p style="color:var(--texte-doux);">Ton panier est vide.</p>`;
    totalConteneur.textContent = "";
    blocCommande.style.display = "none";
    boutonContinuer.style.display = "none";
    indicateur.style.display = "none";
    etape = 1;
    return;
  }

  mettreAJourEtape();
  listeConteneur.innerHTML = "";
  let total = 0;

  panier.forEach((item) => {
    total += item.prix * item.quantite;
    const ligne = document.createElement("div");
    ligne.className = "ligne-panier";
    ligne.innerHTML = `
      <img src="${echapper(optimiserImage(item.imageUrl, 160))}" alt="${echapper(item.nom)}" loading="lazy" decoding="async">
      <div class="infos">
        <strong>${echapper(item.nom)}</strong><br>
        <span style="color:var(--texte-doux); font-size:0.85rem;">${item.prix.toLocaleString("fr-FR")} FCFA</span>
      </div>
      <div class="controle-quantite">
        <button data-action="moins" data-id="${item.produitId}">−</button>
        <span>${item.quantite}</span>
        <button data-action="plus" data-id="${item.produitId}">+</button>
      </div>
      <button data-action="retirer" data-id="${item.produitId}" class="bouton refus petit">Retirer</button>
    `;
    listeConteneur.appendChild(ligne);
  });

  totalConteneur.textContent = `Total : ${total.toLocaleString("fr-FR")} FCFA`;
}

listeConteneur.addEventListener("click", (e) => {
  const bouton = e.target.closest("button[data-action]");
  if (!bouton) return;

  const panier = recupererPanier();
  const item = panier.find((p) => p.produitId === bouton.dataset.id);
  if (!item) return;

  if (bouton.dataset.action === "plus") item.quantite += 1;
  if (bouton.dataset.action === "moins") item.quantite = Math.max(1, item.quantite - 1);
  if (bouton.dataset.action === "retirer") {
    const nouveauPanier = panier.filter((p) => p.produitId !== item.produitId);
    sauvegarderPanier(nouveauPanier);
    afficherPanier();
    return;
  }

  sauvegarderPanier(panier);
  afficherPanier();
});

formCommande.addEventListener("submit", async (e) => {
  e.preventDefault();

  try { await auth.authStateReady(); } catch {}

  const panier = recupererPanier();
  if (panier.length === 0) return;

  const bouton = document.getElementById("bouton-commander");
  bouton.disabled = true;

  try {
    // Visiteur (sans compte) ou personne connectée
    const profil = auth.currentUser ? await recupererProfil(auth.currentUser.uid) : null;
    // Le total et les vendeurs concernés sont recalculés par la base (prix réels)
    const resultat = await envoyerCommande({
      acheteurUid: auth.currentUser ? auth.currentUser.uid : null,
      acheteurNom: profil?.nom || document.getElementById("commande-nom").value,
      produits: panier,
      nom: document.getElementById("commande-nom").value,
      telephone: document.getElementById("commande-telephone").value,
      quartier: document.getElementById("commande-quartier").value,
      modeContact: document.querySelector('input[name="commande-contact"]:checked').value
    });

    viderPanier();
    afficherMessage(
      resultat === "en_attente_reseau"
        ? "Commande enregistrée. Ta connexion est coupée : elle partira dès que le réseau revient (garde le site ouvert ou reviens dessus)."
        : "Commande envoyée ! Le vendeur va te contacter pour la livraison. Tu paieras à la réception.",
      "succes"
    );
    formCommande.reset();
    etape = 1;
    afficherPanier();
  } catch (err) {
    console.error("Erreur envoi commande :", err);
    afficherMessage(estRefuse(err)
      ? "Commande refusée. Reconnecte-toi puis réessaie."
      : "Erreur lors de l'envoi de la commande. Réessaie.", "erreur");
  } finally {
    bouton.disabled = false;
  }
});

function afficherMessage(texte, type) {
  messageZone.innerHTML = `<div class="message ${type}">${texte}</div>`;
}

afficherPanier();
