// ===========================================================
// article.js — page article.html (lecture d'un article)
// ===========================================================

import { db } from "./firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const parametres = new URLSearchParams(window.location.search);
const idArticle = parametres.get("id");
const conteneur = document.getElementById("contenu-article");
const messageZone = document.getElementById("message-article");

function echapper(texte) {
  return String(texte ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function afficherArticle() {
  if (!idArticle) {
    messageZone.innerHTML = `<div class="message erreur">Article introuvable.</div>`;
    return;
  }

  try {
    const snap = await getDoc(doc(db, "articles", idArticle));
    if (!snap.exists() || snap.data().statut !== "publie") {
      messageZone.innerHTML = `<div class="message erreur">Cet article n'est pas disponible.</div>`;
      return;
    }

    const article = snap.data();
    const image = String(article.imageUrl || "");
    document.title = `${article.titre} — Vend Nous Ta Maladie`;
    conteneur.innerHTML = `
      ${image.startsWith("https://") ? `<img src="${echapper(image)}" alt="${echapper(article.titre)}">` : ""}
      <h1>${echapper(article.titre)}</h1>
      <p style="color:var(--texte-doux); margin-bottom:20px;">Par ${echapper(article.auteurNom)}</p>
      <p>${echapper(article.contenu).replace(/\n/g, "<br>")}</p>
    `;
  } catch (err) {
    console.error("Erreur article :", err);
    messageZone.innerHTML = `<div class="message erreur">Impossible de charger l'article. Réessaie.</div>`;
  }
}

afficherArticle();
