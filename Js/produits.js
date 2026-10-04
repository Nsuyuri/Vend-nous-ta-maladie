// ===========================================================
// produits.js — publication de produits par les vendeurs validés
// Utilisé sur profil.html (publier) et index.html (afficher tout)
// ===========================================================

import { db } from "./firebase-config.js";
import { recupererProfil, surChangementAuth } from "./auth.js";
import { ouvrirCommandeRapide } from "./commande-rapide.js";
import { optimiserImage, afficherToast } from "./outils.js";
import { ajouterAuPanier } from "./panier-utils.js";
import {
  collection, addDoc, query, where, getDocs, orderBy, limit, doc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const blocPublier = document.getElementById("bloc-publier-produit");
const formProduit = document.getElementById("form-produit");
const messageProduit = document.getElementById("message-produit");
const grilleMesProduits = document.getElementById("grille-mes-produits");

let utilisateurConnecte = null;

// ---------- Uniquement sur profil.html : afficher le formulaire si vendeur validé ----------
if (formProduit) {
  surChangementAuth(async (utilisateur) => {
    utilisateurConnecte = utilisateur;
    if (!utilisateur) return;

    // Le bloc « Ajouter un produit » reste caché pour tout le monde sauf les vendeurs validés
    blocPublier.style.display = "none";
    if (await verifierVendeurValide(utilisateur.uid)) {
      blocPublier.style.display = "block";
      chargerMesProduits(utilisateur.uid);
    }
  });

  formProduit.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fichierImage = document.getElementById("produit-image").files[0];
    const bouton = document.getElementById("bouton-publier-produit");

    if (fichierImage && fichierImage.size > 2 * 1024 * 1024) {
      afficherMessage("L'image dépasse 2 Mo. Choisis une image plus légère.", "erreur");
      return;
    }

    // Nouvelle vérification juste avant la publication
    if (!utilisateurConnecte || !(await verifierVendeurValide(utilisateurConnecte.uid))) {
      blocPublier.style.display = "none";
      afficherMessage("Seuls les vendeurs validés peuvent ajouter un produit.", "erreur");
      return;
    }

    bouton.disabled = true;
    bouton.textContent = "Publication en cours...";

    let etape = "envoi de l'image";
    try {
      // 1. On envoie l'image vers Cloudinary
      const { envoyerImage } = await import("./cloudinary.js");
      const urlImage = await envoyerImage(fichierImage, "produits");

      // 2. On enregistre le produit dans Firestore avec le lien de l'image
      etape = "enregistrement du produit";
      const profil = await recupererProfil(utilisateurConnecte.uid);
      await addDoc(collection(db, "produits"), {
        nom: document.getElementById("produit-nom").value,
        prix: Number(document.getElementById("produit-prix").value),
        description: document.getElementById("produit-description").value,
        categorie: document.getElementById("produit-categorie").value,
        composition: document.getElementById("produit-composition").value.trim() || null,
        modeEmploi: document.getElementById("produit-mode-emploi").value,
        effetsSecondaires: document.getElementById("produit-effets-secondaires").value.trim() || null,
        imageUrl: urlImage,
        vendeurUid: utilisateurConnecte.uid,
        vendeurNom: profil.nom,
        dateCreation: new Date().toISOString()
      });

      afficherMessage("Produit publié avec succès.", "succes");
      formProduit.reset();
      chargerMesProduits(utilisateurConnecte.uid);
    } catch (err) {
      console.error("Erreur publication produit :", err);
      const detail = err.code === "permission-denied"
        ? "ton compte n'est pas enregistré comme vendeur validé (règles Firestore)"
        : (err.message || "erreur inconnue");
      afficherMessage(`Échec à l'étape « ${etape} » : ${detail}`, "erreur");
    } finally {
      bouton.disabled = false;
      bouton.textContent = "Publier";
    }
  });
}

// Vrai seulement si l'utilisateur est un vendeur validé
async function verifierVendeurValide(uid) {
  const profil = await recupererProfil(uid);
  if (!profil) return false;
  return profil.role === "vendeur" ||
         profil.statutVendeur === "valide" ||
         await demandeValidee(uid);   // même source que le badge « Vendeur validé »
}

// Vrai si une demande de cet utilisateur a été validée dans "demandesVendeur"
async function demandeValidee(uid) {
  const q = query(collection(db, "demandesVendeur"), where("uid", "==", uid));
  const resultats = await getDocs(q);
  let valide = false;
  resultats.forEach((d) => { if (d.data().statut === "valide") valide = true; });
  return valide;
}

// Empêche l'injection de HTML dans les textes venant des utilisateurs
function echapper(texte) {
  return String(texte ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function chargerMesProduits(uid) {
  const q = query(collection(db, "produits"), where("vendeurUid", "==", uid));
  const resultats = await getDocs(q);
  grilleMesProduits.innerHTML = "";
  resultats.forEach((docSnap) => {
    grilleMesProduits.appendChild(carteProduit(docSnap.id, docSnap.data(), true));
  });
}

function afficherMessage(texte, type) {
  messageProduit.innerHTML = `<div class="message ${type}">${texte}</div>`;
}

// ---------- Uniquement sur index.html : afficher tous les produits ----------
const grilleAccueil = document.getElementById("grille-produits");
if (grilleAccueil) {
  chargerTousLesProduits();
}

const CLE_CACHE_PRODUITS = "cache_produits_vntm";

function dessinerProduits(liste) {
  grilleAccueil.innerHTML = "";
  liste.forEach((p) => grilleAccueil.appendChild(carteProduit(p.id, p)));
}

async function chargerTousLesProduits() {
  // 1) Affichage instantané avec les produits déjà vus sur cet appareil
  try {
    const memoire = JSON.parse(localStorage.getItem(CLE_CACHE_PRODUITS));
    if (Array.isArray(memoire) && memoire.length) dessinerProduits(memoire);
  } catch {}

  // 2) Mise à jour avec les données fraîches (24 produits maximum = chargement léger)
  try {
    const q = query(collection(db, "produits"), orderBy("dateCreation", "desc"), limit(24));
    const resultats = await getDocs(q);
    if (resultats.empty) return; // on laisse les cartes d'exemple si aucun produit réel

    const liste = resultats.docs.map((d) => {
      const x = d.data();
      return {
        id: d.id, nom: x.nom, prix: x.prix, imageUrl: x.imageUrl,
        vendeurUid: x.vendeurUid, vendeurNom: x.vendeurNom
      };
    });
    dessinerProduits(liste);
    try { localStorage.setItem(CLE_CACHE_PRODUITS, JSON.stringify(liste)); } catch {}
  } catch (err) {
    console.error("Erreur chargement produits :", err);
  }
}

// Construit une carte produit avec image et lien vers la fiche détaillée
function carteProduit(id, produit, supprimable = false) {
  const carte = document.createElement("div");
  carte.className = "carte-produit";
  carte.innerHTML = `
    <a href="/produit.html?id=${encodeURIComponent(id)}" style="text-decoration:none; color:inherit;">
      <img src="${echapper(optimiserImage(produit.imageUrl, 400))}" alt="${echapper(produit.nom)}" loading="lazy" decoding="async" style="width:100%; height:140px; object-fit:cover; border-radius:6px; margin-bottom:10px;">
      <h3>${echapper(produit.nom)}</h3>
      <p class="prix">${Number(produit.prix || 0).toLocaleString("fr-FR")} FCFA</p>
      <p class="vendeur">Vendu par ${echapper(produit.vendeurNom)}</p>
    </a>
    <div class="actions-carte">
      <a href="/produit.html?id=${encodeURIComponent(id)}" class="bouton petit">Voir plus</a>
    </div>
  `;

  // Boutons d'achat (accueil uniquement, pas dans « Mes produits »)
  if (!supprimable) {
    const actions = carte.querySelector(".actions-carte");
    const infosProduit = {
      produitId: id,
      nom: produit.nom,
      prix: Number(produit.prix || 0),
      imageUrl: produit.imageUrl,
      vendeurUid: produit.vendeurUid,
      vendeurNom: produit.vendeurNom
    };

    const boutonCommander = document.createElement("button");
    boutonCommander.type = "button";
    boutonCommander.className = "bouton petit bouton-commander";
    boutonCommander.textContent = "Commander";
    boutonCommander.addEventListener("click", () => ouvrirCommandeRapide(infosProduit));

    const boutonPanier = document.createElement("button");
    boutonPanier.type = "button";
    boutonPanier.className = "bouton petit secondaire";
    boutonPanier.textContent = "🛒 Ajouter";
    boutonPanier.addEventListener("click", () => {
      ajouterAuPanier(infosProduit);
      afficherToast("Ajouté au panier ✓");
    });

    actions.appendChild(boutonCommander);
    actions.appendChild(boutonPanier);
  }

  // Bouton Supprimer : uniquement dans « Mes produits » du vendeur
  if (supprimable) {
    const boutonSupprimer = document.createElement("button");
    boutonSupprimer.type = "button";
    boutonSupprimer.className = "bouton refus petit";
    boutonSupprimer.style.cssText = "margin-top:10px; margin-left:8px;";
    boutonSupprimer.textContent = "Supprimer";
    boutonSupprimer.addEventListener("click", async () => {
      if (!confirm(`Supprimer « ${produit.nom} » ? Cette action est définitive.`)) return;
      boutonSupprimer.disabled = true;
      boutonSupprimer.textContent = "Suppression...";
      try {
        await deleteDoc(doc(db, "produits", id));
        carte.remove();
        afficherMessage("Produit supprimé.", "succes");
      } catch (err) {
        console.error("Erreur suppression produit :", err);
        boutonSupprimer.disabled = false;
        boutonSupprimer.textContent = "Supprimer";
        afficherMessage(
          err.code === "permission-denied"
            ? "Suppression refusée par les règles Firestore."
            : "Impossible de supprimer le produit. Réessaie.",
          "erreur"
        );
      }
    });
    carte.appendChild(boutonSupprimer);
  }
  return carte;
}
