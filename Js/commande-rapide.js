// ===========================================================
// commande-rapide.js — « Commander » : coordonnées + 1 bouton
//   Clic 1 : « Commander » sur le produit → on demande les coordonnées
//   Clic 2 : « Commander » dans la fenêtre → la commande part immédiatement
// Les coordonnées sont mémorisées sur l'appareil et pré-remplies ensuite.
// Connexion lente ou coupée : la commande est gardée sur le téléphone
// et part dès que le réseau revient.
// ===========================================================

import { db, auth } from "./firebase-config.js";
import { addDoc, collection } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { recupererProfil } from "./auth.js";
import { optimiserImage } from "./outils.js";

const CLE_INFOS = "infos_livraison_vntm";

function echapper(texte) {
  return String(texte ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function lireInfos() {
  try { return JSON.parse(localStorage.getItem(CLE_INFOS)) || {}; }
  catch { return {}; }
}

function sauverInfos(infos) {
  try { localStorage.setItem(CLE_INFOS, JSON.stringify(infos)); } catch {}
}

function infosCompletes(i) {
  return !!(i.nom && i.quartier && String(i.telephone || "").replace(/\D/g, "").length >= 8);
}

// produit = { produitId, nom, prix, imageUrl, vendeurUid, vendeurNom }
export async function ouvrirCommandeRapide(produit) {
  if (document.getElementById("commande-rapide-fond")) return;

  try { if (auth.authStateReady) await auth.authStateReady(); } catch {}
  const utilisateur = auth.currentUser;

  const fond = document.createElement("div");
  fond.id = "commande-rapide-fond";
  fond.className = "cr-fond";
  const feuille = document.createElement("div");
  feuille.className = "cr-feuille";
  fond.appendChild(feuille);
  document.body.appendChild(fond);

  const fermer = () => fond.remove();
  fond.addEventListener("click", (e) => { if (e.target === fond) fermer(); });

  const messageSimple = (titre, texte, boutonHtml) => {
    feuille.innerHTML = `
      <h3>${titre}</h3>
      <p style="margin:8px 0 14px; color:var(--texte-doux);">${texte}</p>
      ${boutonHtml || ""}
      <button type="button" class="bouton secondaire" data-fermer style="width:100%; margin-top:8px;">Fermer</button>`;
    feuille.querySelector("[data-fermer]").addEventListener("click", fermer);
  };

  if (!utilisateur) {
    messageSimple(
      "Connecte-toi pour commander",
      "Une seule fois. Ensuite, tes coordonnées sont déjà pré-remplies.",
      `<a href="profil.html" class="bouton" style="display:block; text-align:center;">Me connecter</a>`
    );
    return;
  }

  if (produit.vendeurUid === utilisateur.uid) {
    messageSimple("C'est ton produit", "Tu ne peux pas commander un produit que tu vends toi-même.");
    return;
  }

  let quantite = 1;
  const infos = lireInfos();
  const prix = Number(produit.prix || 0);

  feuille.innerHTML = `
    <div class="cr-entete">
      <h3>Tes coordonnées</h3>
      <button type="button" class="cr-x" data-fermer aria-label="Fermer">✕</button>
    </div>
    <div class="cr-produit">
      <img src="${echapper(optimiserImage(produit.imageUrl, 120))}" alt="" decoding="async">
      <div>
        <strong>${echapper(produit.nom)}</strong><br>
        <span style="color:var(--texte-doux); font-size:0.85rem;">${prix.toLocaleString("fr-FR")} FCFA</span>
      </div>
      <div class="controle-quantite">
        <button type="button" data-q="moins" aria-label="Moins">−</button>
        <span id="cr-quantite">1</span>
        <button type="button" data-q="plus" aria-label="Plus">+</button>
      </div>
    </div>

    <div class="champ"><label for="cr-nom">Nom</label>
      <input id="cr-nom" value="${echapper(infos.nom || "")}" autocomplete="name"></div>
    <div class="rangee">
      <div class="champ"><label for="cr-tel">Téléphone</label>
        <input id="cr-tel" type="tel" inputmode="tel" value="${echapper(infos.telephone || "")}" autocomplete="tel"></div>
      <div class="champ"><label for="cr-quartier">Quartier</label>
        <input id="cr-quartier" value="${echapper(infos.quartier || "")}"></div>
    </div>
    <div class="champ"><label for="cr-contact">Le vendeur te contacte par</label>
      <select id="cr-contact">
        <option value="les_deux">Appel et WhatsApp</option>
        <option value="appel">Appel</option>
        <option value="whatsapp">WhatsApp</option>
      </select></div>

    <p style="font-size:0.85rem; color:var(--texte-doux); margin:2px 0 10px;">Tu paies uniquement à la réception de ta commande.</p>
    <div id="cr-message"></div>
    <button type="button" class="bouton" id="cr-confirmer" style="width:100%;"></button>
  `;

  const champNom = feuille.querySelector("#cr-nom");
  const champTel = feuille.querySelector("#cr-tel");
  const champQuartier = feuille.querySelector("#cr-quartier");
  const champContact = feuille.querySelector("#cr-contact");
  champContact.value = infos.modeContact || "les_deux";
  const bouton = feuille.querySelector("#cr-confirmer");
  const message = feuille.querySelector("#cr-message");

  const majTotal = () => {
    feuille.querySelector("#cr-quantite").textContent = quantite;
    bouton.textContent = `Commander — ${(prix * quantite).toLocaleString("fr-FR")} FCFA`;
  };
  majTotal();

  feuille.querySelectorAll("[data-fermer]").forEach((b) => b.addEventListener("click", fermer));
  feuille.querySelectorAll("[data-q]").forEach((b) => b.addEventListener("click", () => {
    quantite = b.dataset.q === "plus" ? Math.min(quantite + 1, 99) : Math.max(1, quantite - 1);
    majTotal();
  }));

  bouton.addEventListener("click", async () => {
    const donnees = {
      nom: champNom.value.trim(),
      telephone: champTel.value.trim(),
      quartier: champQuartier.value.trim(),
      modeContact: champContact.value
    };
    if (!infosCompletes(donnees)) {
      message.innerHTML = `<div class="message erreur">Remplis ton nom, ton téléphone et ton quartier.</div>`;
      return;
    }

    bouton.disabled = true;
    bouton.textContent = "Envoi en cours...";
    sauverInfos(donnees);

    try {
      let nomAcheteur = donnees.nom;
      try {
        const profil = await recupererProfil(utilisateur.uid);
        if (profil && profil.nom) nomAcheteur = profil.nom;
      } catch {}

      const envoi = addDoc(collection(db, "commandes"), {
        acheteurUid: utilisateur.uid,
        acheteurNom: nomAcheteur,
        produits: [{
          produitId: produit.produitId,
          nom: produit.nom,
          prix: prix,
          imageUrl: produit.imageUrl,
          vendeurUid: produit.vendeurUid,
          vendeurNom: produit.vendeurNom,
          quantite: quantite
        }],
        vendeurUids: [produit.vendeurUid],
        total: prix * quantite,
        nom: donnees.nom,
        telephone: donnees.telephone,
        quartier: donnees.quartier,
        modeContact: donnees.modeContact,
        statut: "en_attente",
        dateCreation: new Date().toISOString()
      });

      // Connexion lente : après 8 s, on rassure l'acheteur (la commande est gardée sur l'appareil)
      const resultat = await Promise.race([
        envoi.then(() => "envoyee"),
        new Promise((r) => setTimeout(() => r("en_attente_reseau"), 8000))
      ]);
      envoi.catch((e) => console.error("Commande en attente :", e));

      const enAttente = resultat === "en_attente_reseau";
      feuille.innerHTML = `
        <div style="text-align:center; padding:10px 0;">
          <div style="font-size:2.4rem;">${enAttente ? "📶" : "✅"}</div>
          <h3 style="margin:6px 0;">${enAttente ? "Commande enregistrée" : "Commande envoyée !"}</h3>
          <p style="color:var(--texte-doux); margin-bottom:14px;">${enAttente
            ? "Ta connexion est lente. Ta commande est gardée sur ton téléphone et partira dès que le réseau revient. Garde le site ouvert ou reviens dessus."
            : "Le vendeur va te contacter pour la livraison. Tu paies à la réception."}</p>
          <button type="button" class="bouton" data-fermer style="width:100%;">Fermer</button>
        </div>`;
      feuille.querySelector("[data-fermer]").addEventListener("click", fermer);
    } catch (err) {
      console.error("Erreur commande rapide :", err);
      message.innerHTML = `<div class="message erreur">Erreur lors de l'envoi${err.code === "permission-denied" ? " (refusé par les règles Firestore)" : ""}. Réessaie.</div>`;
      bouton.disabled = false;
      majTotal();
    }
  });
}
