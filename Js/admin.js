// ===========================================================
// admin.js — logique de la page admin.html
// Réservée aux comptes dont le rôle Firestore est "admin".
// Pour créer un admin : dans la console Firebase > Firestore,
// ouvre le document utilisateurs/{uid} du compte concerné et
// change manuellement le champ "role" en "admin".
// ===========================================================

import { db } from "./firebase-config.js";
import { recupererProfil, surChangementAuth } from "./auth.js";
import {
  collection, query, where, getDocs, doc, getDoc, updateDoc
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const corpsTableau = document.getElementById("corps-tableau");
const messageAdmin = document.getElementById("message-admin");

surChangementAuth(async (utilisateur) => {
  if (!utilisateur) {
    afficherMessage("Connecte-toi avec un compte admin pour accéder à cette page.", "erreur");
    return;
  }

  const profil = await recupererProfil(utilisateur.uid);
  if (!profil || profil.role !== "admin") {
    afficherMessage("Accès réservé aux administrateurs.", "erreur");
    return;
  }

  chargerDemandes();
  chargerArticles();
});

async function chargerDemandes() {
  const q = query(collection(db, "demandesVendeur"), where("statut", "==", "en_attente"));
  const resultats = await getDocs(q);

  if (resultats.empty) {
    corpsTableau.innerHTML = `<tr><td colspan="7">Aucune demande en attente.</td></tr>`;
    return;
  }

  corpsTableau.innerHTML = "";
  for (const docSnap of resultats.docs) {
    const demande = docSnap.data();
    const idDemande = docSnap.id;

    // On récupère le nom de l'utilisateur qui a fait la demande
    const snapUtilisateur = await getDoc(doc(db, "utilisateurs", demande.uid));
    const nom = snapUtilisateur.exists() ? snapUtilisateur.data().nom : "Utilisateur inconnu";

    const positionAffichage = demande.position?.texte
      ? demande.position.texte
      : (demande.position?.lat
          ? `<a href="https://www.google.com/maps?q=${demande.position.lat},${demande.position.lng}" target="_blank">Voir sur la carte</a>`
          : "Non renseignée");

    const ligne = document.createElement("tr");
    ligne.innerHTML = `
      <td>${nom}</td>
      <td>${demande.specialite}</td>
      <td>${demande.anciennete} ans</td>
      <td>${demande.telephone || "—"}</td>
      <td>${positionAffichage}</td>
      <td>${demande.description}</td>
      <td class="actions-demande">
        <button class="bouton petit" data-action="valider" data-id="${idDemande}" data-uid="${demande.uid}">Valider</button>
        <button class="bouton petit refus" data-action="refuser" data-id="${idDemande}" data-uid="${demande.uid}">Refuser</button>
      </td>
    `;
    corpsTableau.appendChild(ligne);
  }

  // Un seul écouteur sur le tableau, pour tous les boutons
  corpsTableau.addEventListener("click", gererClicAction);
}

async function gererClicAction(e) {
  const bouton = e.target.closest("button[data-action]");
  if (!bouton) return;

  const action = bouton.dataset.action;
  const idDemande = bouton.dataset.id;
  const uidVendeur = bouton.dataset.uid;
  const nouveauStatut = action === "valider" ? "valide" : "refuse";

  bouton.closest("tr").style.opacity = "0.5";

  try {
    // Met à jour la demande
    await updateDoc(doc(db, "demandesVendeur", idDemande), { statut: nouveauStatut });

    // Met à jour le profil utilisateur (rôle + statut)
    await updateDoc(doc(db, "utilisateurs", uidVendeur), {
      statutVendeur: nouveauStatut,
      role: nouveauStatut === "valide" ? "vendeur" : "acheteur"
    });

    bouton.closest("tr").remove();
  } catch (err) {
    afficherMessage("Erreur lors du traitement de la demande.", "erreur");
    bouton.closest("tr").style.opacity = "1";
  }
}

function afficherMessage(texte, type) {
  messageAdmin.innerHTML = `<div class="message ${type}">${texte}</div>`;
}

// ---------- Articles en attente ----------
const corpsTableauArticles = document.getElementById("corps-tableau-articles");

function echapperArticle(texte) {
  return String(texte ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Fenêtre de lecture : affiche l'article en entier (même en attente)
function ouvrirLectureArticle(article) {
  const fond = document.createElement("div");
  fond.style.cssText = "position:fixed; inset:0; background:rgba(0,0,0,.55); z-index:1000; display:flex; align-items:flex-start; justify-content:center; padding:20px 12px; overflow-y:auto;";
  const image = String(article.imageUrl || "");
  fond.innerHTML = `
    <div style="background:#fff; border-radius:12px; max-width:700px; width:100%; padding:20px; position:relative;">
      <button type="button" class="bouton secondaire petit" data-fermer style="position:sticky; top:0; float:right;">✕ Fermer</button>
      ${image.startsWith("https://") ? `<img src="${echapperArticle(image)}" alt="" style="max-width:100%; border-radius:8px; margin-bottom:12px;">` : ""}
      <h2 style="margin-bottom:4px;">${echapperArticle(article.titre)}</h2>
      <p style="color:var(--texte-doux); margin-bottom:16px;">Par ${echapperArticle(article.auteurNom)}</p>
      <p style="line-height:1.6;">${echapperArticle(article.contenu).replace(/\n/g, "<br>")}</p>
    </div>
  `;
  fond.addEventListener("click", (e) => {
    if (e.target === fond || e.target.closest("[data-fermer]")) fond.remove();
  });
  document.body.appendChild(fond);
}

async function chargerArticles() {
  const q = query(collection(db, "articles"), where("statut", "==", "en_attente"));
  const resultats = await getDocs(q);

  if (resultats.empty) {
    corpsTableauArticles.innerHTML = `<tr><td colspan="4">Aucun article en attente.</td></tr>`;
    return;
  }

  corpsTableauArticles.innerHTML = "";
  const articlesParId = {};
  resultats.forEach((docSnap) => {
    const article = docSnap.data();
    articlesParId[docSnap.id] = article;
    const ligne = document.createElement("tr");
    ligne.innerHTML = `
      <td><a href="#" data-lire="${docSnap.id}">${echapperArticle(article.titre)}</a></td>
      <td>${echapperArticle(article.auteurNom)}</td>
      <td>${echapperArticle(String(article.contenu || "").slice(0, 100))}...</td>
      <td class="actions-demande">
        <button class="bouton petit secondaire" data-lire="${docSnap.id}">Lire</button>
        <button class="bouton petit" data-action-article="publie" data-id="${docSnap.id}">Publier</button>
        <button class="bouton petit refus" data-action-article="refuse" data-id="${docSnap.id}">Refuser</button>
      </td>
    `;
    corpsTableauArticles.appendChild(ligne);
  });

  corpsTableauArticles.addEventListener("click", async (e) => {
    const lien = e.target.closest("[data-lire]");
    if (lien) {
      e.preventDefault();
      const article = articlesParId[lien.dataset.lire];
      if (article) ouvrirLectureArticle(article);
      return;
    }
    const bouton = e.target.closest("button[data-action-article]");
    if (!bouton) return;
    const nouveauStatut = bouton.dataset.actionArticle;
    try {
      await updateDoc(doc(db, "articles", bouton.dataset.id), { statut: nouveauStatut });
      bouton.closest("tr").remove();
    } catch (err) {
      afficherMessage("Erreur lors du traitement de l'article.", "erreur");
    }
  });
}
