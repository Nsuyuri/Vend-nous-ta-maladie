// ===========================================================
// ecrire-article.js — section "Écrire un article" sur profil.html
// ===========================================================

import { sb, ok, camelListe, snake, auth, estRefuse } from "./supabase-config.js";
import { recupererProfil, surChangementAuth } from "./auth.js";
import { verifierPhoto } from "./limites-images.js";

const formArticle = document.getElementById("form-article");
const messageZone = document.getElementById("message-article-profil");
const listeMesArticles = document.getElementById("liste-mes-articles");

surChangementAuth((utilisateur) => {
  if (utilisateur) chargerMesArticles(utilisateur.uid);
});

formArticle.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!auth.currentUser) return;

  const bouton = document.getElementById("bouton-publier-article");
  bouton.disabled = true;

  try {
    const fichierImage = document.getElementById("article-image").files[0];
    let urlImage = null;

    const probleme = await verifierPhoto(fichierImage);
    if (probleme) {
      afficherMessage(probleme, "erreur");
      return;
    }

    if (fichierImage) {
      const { envoyerImage } = await import("./cloudinary.js");
      urlImage = await envoyerImage(fichierImage, "articles");
    }

    const profil = await recupererProfil(auth.currentUser.uid);
    ok(await sb.from("articles").insert(snake({
      titre: document.getElementById("article-titre").value,
      contenu: document.getElementById("article-contenu").value,
      imageUrl: urlImage,
      auteurUid: auth.currentUser.uid,
      auteurNom: profil.nom
    })));

    afficherMessage("Article soumis. Il sera visible sur le blog après validation.", "succes");
    formArticle.reset();
    chargerMesArticles(auth.currentUser.uid);
  } catch (err) {
    console.error("Erreur envoi article :", err);
    afficherMessage("Erreur lors de l'envoi. Réessaie.", "erreur");
  } finally {
    bouton.disabled = false;
  }
});

// Empêche l'injection de HTML dans les titres
function echapper(texte) {
  return String(texte ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function afficherAucunArticle() {
  listeMesArticles.innerHTML = `<p style="color:var(--texte-doux); font-size:0.9rem;">Aucun article pour l'instant.</p>`;
}

async function chargerMesArticles(uid) {
  const articles = camelListe(ok(
    await sb.from("articles").select("*").eq("auteur_uid", uid).order("date_creation", { ascending: false })
  ));

  if (articles.length === 0) {
    afficherAucunArticle();
    return;
  }

  const labels = { en_attente: "attente", publie: "publie", refuse: "refuse" };
  const textes = { en_attente: "En attente", publie: "Publié", refuse: "Refusé" };

  listeMesArticles.innerHTML = "";
  articles.forEach((a) => {
    const ligne = document.createElement("div");
    ligne.style.cssText = "display:flex; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:10px;";
    ligne.innerHTML = `
      <span>${a.statut === "publie"
        ? `<a href="/article.html?id=${encodeURIComponent(a.id)}">${echapper(a.titre)}</a>`
        : echapper(a.titre)} —</span>
      <span class="statut-badge ${labels[a.statut] || ""}">${textes[a.statut] || echapper(a.statut)}</span>
    `;

    // Bouton Supprimer (l'auteur supprime son propre article)
    const boutonSupprimer = document.createElement("button");
    boutonSupprimer.type = "button";
    boutonSupprimer.className = "bouton refus petit";
    boutonSupprimer.textContent = "Supprimer";
    boutonSupprimer.addEventListener("click", async () => {
      if (!confirm(`Supprimer l'article « ${a.titre} » ? Cette action est définitive.`)) return;
      boutonSupprimer.disabled = true;
      boutonSupprimer.textContent = "Suppression...";
      try {
        const supprimes = ok(await sb.from("articles").delete().eq("id", a.id).select("id"));
        if (!supprimes.length) throw Object.assign(new Error("refusé"), { code: "42501" });
        ligne.remove();
        if (!listeMesArticles.children.length) afficherAucunArticle();
        afficherMessage("Article supprimé.", "succes");
      } catch (err) {
        console.error("Erreur suppression article :", err);
        boutonSupprimer.disabled = false;
        boutonSupprimer.textContent = "Supprimer";
        afficherMessage(
          estRefuse(err)
            ? "Suppression refusée."
            : "Impossible de supprimer l'article. Réessaie.",
          "erreur"
        );
      }
    });
    ligne.appendChild(boutonSupprimer);
    listeMesArticles.appendChild(ligne);
  });
}

function afficherMessage(texte, type) {
  messageZone.innerHTML = `<div class="message ${type}">${texte}</div>`;
}
