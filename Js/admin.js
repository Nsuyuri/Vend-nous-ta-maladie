// ===========================================================
// admin.js — logique de la page admin.html
// Réservée aux comptes dont le rôle est "admin".
// Pour créer un admin : dans Supabase > SQL Editor, exécute
//   update public.utilisateurs set role = 'admin' where email = 'ton-email';
// ===========================================================

import { sb, ok, camelListe } from "./supabase-config.js";
import { recupererProfil, surChangementAuth } from "./auth.js";

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
  const demandes = camelListe(ok(
    await sb.from("demandes_vendeur").select("*, utilisateurs(nom)").eq("statut", "en_attente").order("date_envoi")
  ));

  if (demandes.length === 0) {
    corpsTableau.innerHTML = `<tr><td colspan="7">Aucune demande en attente.</td></tr>`;
    return;
  }

  corpsTableau.innerHTML = "";
  for (const demande of demandes) {
    const idDemande = demande.id;
    const nom = echapperArticle(demande.utilisateurs?.nom || "Utilisateur inconnu");

    const positionAffichage = demande.position?.texte
      ? echapperArticle(demande.position.texte)
      : (demande.position?.lat
          ? `<a href="https://www.google.com/maps?q=${demande.position.lat},${demande.position.lng}" target="_blank">Voir sur la carte</a>`
          : "Non renseignée");

    const ligne = document.createElement("tr");
    ligne.innerHTML = `
      <td>${nom}</td>
      <td>${echapperArticle(demande.specialite)}</td>
      <td>${Number(demande.anciennete) || 0} ans</td>
      <td>${echapperArticle(demande.telephone || "—")}</td>
      <td>${positionAffichage}</td>
      <td>${echapperArticle(demande.description)}</td>
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
    // La base met à jour la demande ET le rôle de l'utilisateur en une seule fois
    ok(await sb.rpc("traiter_demande_vendeur", { p_demande: idDemande, p_statut: nouveauStatut }));

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
  const articlesAttente = camelListe(ok(
    await sb.from("articles").select("*").eq("statut", "en_attente").order("date_creation")
  ));

  if (articlesAttente.length === 0) {
    corpsTableauArticles.innerHTML = `<tr><td colspan="4">Aucun article en attente.</td></tr>`;
    return;
  }

  corpsTableauArticles.innerHTML = "";
  const articlesParId = {};
  articlesAttente.forEach((article) => {
    articlesParId[article.id] = article;
    const ligne = document.createElement("tr");
    ligne.innerHTML = `
      <td><a href="#" data-lire="${article.id}">${echapperArticle(article.titre)}</a></td>
      <td>${echapperArticle(article.auteurNom)}</td>
      <td>${echapperArticle(String(article.contenu || "").slice(0, 100))}...</td>
      <td class="actions-demande">
        <button class="bouton petit secondaire" data-lire="${article.id}">Lire</button>
        <button class="bouton petit" data-action-article="publie" data-id="${article.id}">Publier</button>
        <button class="bouton petit refus" data-action-article="refuse" data-id="${article.id}">Refuser</button>
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
      const lignes = ok(await sb.from("articles").update({ statut: nouveauStatut }).eq("id", bouton.dataset.id).select("id"));
      if (!lignes.length) throw new Error("Modification refusée");
      bouton.closest("tr").remove();
    } catch (err) {
      afficherMessage("Erreur lors du traitement de l'article.", "erreur");
    }
  });
}
