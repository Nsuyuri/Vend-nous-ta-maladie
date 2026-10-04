// ===========================================================
// blog.js — page blog.html : tous les articles publiés, cliquables
// ===========================================================

import { db } from "./firebase-config.js";
import {
  collection, query, where, getDocs
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const grille = document.getElementById("grille-blog");

function echapper(texte) {
  return String(texte ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function chargerArticlesPublies() {
  try {
    // Pas de orderBy ici : il demanderait un index Firestore. Le tri se fait ci-dessous.
    const q = query(collection(db, "articles"), where("statut", "==", "publie"));
    const resultats = await getDocs(q);

    if (resultats.empty) {
      grille.innerHTML = `<p style="color:var(--texte-doux);">Aucun article publié pour l'instant.</p>`;
      return;
    }

    const articles = resultats.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => String(b.dateCreation || "").localeCompare(String(a.dateCreation || "")));

    grille.innerHTML = "";
    articles.forEach((article) => {
      const carte = document.createElement("a");
      carte.href = `/article.html?id=${encodeURIComponent(article.id)}`;
      carte.className = "carte-article";
      carte.innerHTML = `
        <h3>${echapper(article.titre)}</h3>
        <p class="meta">Par ${echapper(article.auteurNom)}</p>
        <p>${echapper(String(article.contenu || "").slice(0, 140))}...</p>
        <span class="lire-suite">Lire l'article →</span>
      `;
      grille.appendChild(carte);
    });
  } catch (err) {
    console.error("Erreur chargement blog :", err);
    grille.innerHTML = `<p style="color:var(--erreur);">Impossible de charger les articles. Réessaie dans un instant.</p>`;
  }
}

chargerArticlesPublies();
