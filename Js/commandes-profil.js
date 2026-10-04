// ===========================================================
// commandes-profil.js — sections "Mes commandes" / "Commandes reçues"
// Livraison simplifiée : 2 statuts (À livrer → Livrée), paiement à la réception
// ===========================================================

import { db } from "./firebase-config.js";
import { recupererProfil, surChangementAuth } from "./auth.js";
import {
  collection, query, where, getDocs, doc, updateDoc
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const listeMesCommandes = document.getElementById("liste-mes-commandes");
const blocCommandesRecues = document.getElementById("bloc-commandes-recues");
const listeCommandesRecues = document.getElementById("liste-commandes-recues");

// Seuls 2 statuts : "en_attente" (à livrer) et "livree".
// Les anciens statuts (confirmee, en_livraison) comptent comme « à livrer ».
const LABELS_VENDEUR = { en_attente: "À livrer", livree: "Livrée" };
const LABELS_ACHETEUR = { en_attente: "En attente de livraison", livree: "Livrée" };
const LABELS_CONTACT = { appel: "Appel téléphonique", whatsapp: "WhatsApp", les_deux: "Appel ou WhatsApp" };

function normaliserStatut(statut) {
  return statut === "livree" ? "livree" : "en_attente";
}

function echapper(texte) {
  return String(texte ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formaterDate(iso) {
  const d = new Date(iso);
  return isNaN(d) ? "" : d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

// Numéro au format international (Côte d'Ivoire par défaut : 8 ou 10 chiffres → indicatif 225)
function numeroInternational(telephone) {
  let chiffres = String(telephone ?? "").replace(/\D/g, "");
  if (chiffres.startsWith("00")) chiffres = chiffres.slice(2);
  if (chiffres.startsWith("225") && chiffres.length >= 11) return chiffres;
  if (chiffres.length === 8 || chiffres.length === 10) return "225" + chiffres;
  return chiffres;
}

// Vrai si une demande de cet utilisateur a été validée dans "demandesVendeur"
async function demandeValidee(uid) {
  const q = query(collection(db, "demandesVendeur"), where("uid", "==", uid));
  const resultats = await getDocs(q);
  let valide = false;
  resultats.forEach((d) => { if (d.data().statut === "valide") valide = true; });
  return valide;
}

surChangementAuth(async (utilisateur) => {
  if (!utilisateur) return;

  chargerMesCommandes(utilisateur.uid);

  try {
    const profil = await recupererProfil(utilisateur.uid);
    const estVendeur = profil && (
      profil.role === "vendeur" ||
      profil.statutVendeur === "valide" ||
      await demandeValidee(utilisateur.uid)
    );
    if (estVendeur) {
      blocCommandesRecues.style.display = "block";
      chargerCommandesRecues(utilisateur.uid, profil.nom);
    }
  } catch (err) {
    console.error("Erreur commandes reçues :", err);
  }
});

// ---------- Commandes passées en tant qu'acheteur ----------
async function chargerMesCommandes(uid) {
  try {
    const q = query(collection(db, "commandes"), where("acheteurUid", "==", uid));
    const resultats = await getDocs(q);

    if (resultats.empty) {
      listeMesCommandes.innerHTML = `<p style="font-size:0.9rem;">Aucune commande pour l'instant.</p>`;
      return;
    }

    listeMesCommandes.innerHTML = `<p style="font-size:0.85rem; margin-bottom:10px;">Tu paies à la réception de ta commande.</p>`;
    resultats.forEach((docSnap) => {
      const c = docSnap.data();
      const statut = normaliserStatut(c.statut);
      const carte = document.createElement("div");
      carte.className = "carte-commande";
      carte.innerHTML = `
        <span class="statut-badge ${statut}">${LABELS_ACHETEUR[statut]}</span>
        <p class="produits-commande">${(c.produits || []).map((p) => `${echapper(p.nom)} x${Number(p.quantite) || 1}`).join(", ")}</p>
        <strong>${Number(c.total || 0).toLocaleString("fr-FR")} FCFA</strong>
      `;
      listeMesCommandes.appendChild(carte);
    });
  } catch (err) {
    console.error("Erreur mes commandes :", err);
    listeMesCommandes.innerHTML = `<p style="font-size:0.9rem;">Impossible de charger tes commandes.</p>`;
  }
}

// ---------- Commandes reçues en tant que vendeur ----------
async function chargerCommandesRecues(uidVendeur, nomVendeur) {
  try {
    const q = query(collection(db, "commandes"), where("vendeurUids", "array-contains", uidVendeur));
    const resultats = await getDocs(q);

    if (resultats.empty) {
      listeCommandesRecues.innerHTML = `<p style="font-size:0.9rem; color:var(--texte-doux);">Aucune commande reçue pour l'instant.</p>`;
      return;
    }

    const commandes = [];
    resultats.forEach((d) => commandes.push({ id: d.id, ...d.data() }));

    // Les commandes à livrer d'abord, puis les plus récentes
    commandes.sort((a, b) => {
      const pa = normaliserStatut(a.statut) === "en_attente" ? 0 : 1;
      const pb = normaliserStatut(b.statut) === "en_attente" ? 0 : 1;
      if (pa !== pb) return pa - pb;
      return String(b.dateCreation || "").localeCompare(String(a.dateCreation || ""));
    });

    listeCommandesRecues.innerHTML = `<p id="resume-commandes" style="font-weight:600; margin-bottom:4px;"></p>
      <p style="font-size:0.85rem; color:var(--texte-doux); margin-bottom:12px;">Le paiement se fait à la livraison, une fois le produit remis à l'acheteur.</p>`;
    commandes.forEach((c) => listeCommandesRecues.appendChild(carteCommandeRecue(c, uidVendeur, nomVendeur)));
    mettreAJourResume();
  } catch (err) {
    console.error("Erreur chargement commandes reçues :", err);
    listeCommandesRecues.innerHTML = `<p style="font-size:0.9rem; color:var(--erreur);">Impossible de charger les commandes${err.code === "permission-denied" ? " (accès refusé par les règles Firestore)" : ""}.</p>`;
  }
}

function carteCommandeRecue(c, uidVendeur, nomVendeur) {
  const mesProduits = (c.produits || []).filter((p) => p.vendeurUid === uidVendeur);
  const montant = mesProduits.reduce((somme, p) => somme + Number(p.prix || 0) * Number(p.quantite || 1), 0);
  const listeProduits = mesProduits.map((p) => `${p.nom} x${Number(p.quantite) || 1}`).join(", ");

  // Mode de contact choisi par l'acheteur (anciennes commandes : les deux)
  const mode = ["appel", "whatsapp", "les_deux"].includes(c.modeContact) ? c.modeContact : "les_deux";
  const numero = numeroInternational(c.telephone);
  const messageWhatsApp = `Bonjour ${c.nom || ""}, c'est ${nomVendeur || "le vendeur"} (Vend Nous Ta Maladie). J'ai bien reçu ta commande : ${listeProduits}. Quand puis-je te livrer ? Tu paies à la réception.`;

  const boutonAppel = mode !== "whatsapp"
    ? `<a class="bouton petit" href="tel:+${numero}">📞 Appeler</a>` : "";
  const boutonWhatsApp = mode !== "appel"
    ? `<a class="bouton secondaire petit" href="https://wa.me/${numero}?text=${encodeURIComponent(messageWhatsApp)}" target="_blank" rel="noopener">💬 WhatsApp</a>` : "";

  const carte = document.createElement("div");
  carte.className = "carte-commande";
  carte.dataset.statut = normaliserStatut(c.statut);
  carte.innerHTML = `
    <span class="statut-badge"></span>
    <span style="font-size:0.82rem; color:var(--texte-doux); margin-left:8px;">${formaterDate(c.dateCreation)}</span>
    <p style="margin-top:8px;"><strong>${echapper(c.nom)}</strong> — ${echapper(c.telephone)} — ${echapper(c.quartier)}</p>
    <p class="produits-commande">${echapper(listeProduits)}</p>
    ${montant > 0 ? `<strong>${montant.toLocaleString("fr-FR")} FCFA</strong> <span style="font-size:0.82rem; color:var(--texte-doux);">à encaisser à la livraison</span><br>` : ""}
    <span style="font-size:0.82rem; color:var(--texte-doux);">Contact souhaité : ${LABELS_CONTACT[mode]}</span>
    <div style="display:flex; flex-wrap:wrap; gap:8px; margin-top:10px;">
      ${boutonAppel}
      ${boutonWhatsApp}
      <button type="button" class="bouton petit" data-livraison></button>
    </div>
  `;

  const badge = carte.querySelector(".statut-badge");
  const boutonLivraison = carte.querySelector("[data-livraison]");

  function afficherStatut() {
    const statut = carte.dataset.statut;
    badge.className = `statut-badge ${statut}`;
    badge.textContent = LABELS_VENDEUR[statut];
    boutonLivraison.textContent = statut === "livree" ? "Annuler la livraison" : "Marquer comme livrée";
    boutonLivraison.classList.toggle("refus", statut === "livree");
  }
  afficherStatut();

  boutonLivraison.addEventListener("click", async () => {
    const ancien = carte.dataset.statut;
    const nouveau = ancien === "livree" ? "en_attente" : "livree";
    if (nouveau === "livree" && !confirm("Confirmer que cette commande a été livrée et payée ?")) return;

    boutonLivraison.disabled = true;
    try {
      await updateDoc(doc(db, "commandes", c.id), { statut: nouveau });
      carte.dataset.statut = nouveau;
      afficherStatut();
      mettreAJourResume();
    } catch (err) {
      console.error("Erreur changement de statut :", err);
      alert(err.code === "permission-denied"
        ? "Modification refusée par les règles Firestore."
        : "Impossible de changer le statut. Réessaie.");
    } finally {
      boutonLivraison.disabled = false;
    }
  });

  return carte;
}

// Affiche « N commande(s) à livrer » en haut de la liste
function mettreAJourResume() {
  const resume = document.getElementById("resume-commandes");
  if (!resume) return;
  const aLivrer = listeCommandesRecues.querySelectorAll('.carte-commande[data-statut="en_attente"]').length;
  resume.textContent = aLivrer === 0
    ? "Aucune commande à livrer."
    : `${aLivrer} commande${aLivrer > 1 ? "s" : ""} à livrer`;
}
