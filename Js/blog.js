// ===========================================================
// blog.js — page blog.html : tous les articles publiés, cliquables
// ===========================================================

import { sb, ok, camelListe } from "./supabase-config.js";

const grille = document.getElementById("grille-blog");

function echapper(texte) {
  return String(texte ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function chargerArticlesPublies() {
  try {
    const articles = camelListe(ok(
      await sb.from("articles").select("*").eq("statut", "publie").order("date_creation", { ascending: false })
    ));

    if (articles.length === 0) {
      grille.innerHTML = `<p style="color:var(--texte-doux);">Aucun article publié pour l'instant.</p>`;
      return;
    }

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
