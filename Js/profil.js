// ===========================================================
// profil.js — logique de la page profil.html
// ===========================================================

import { db } from "./firebase-config.js";
import {
  inscription, connexion, deconnexion,
  recupererProfil, surChangementAuth, traduireErreurFirebase
} from "./auth.js";
import {
  collection, addDoc, query, where, getDocs, doc, updateDoc
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { envoyerImage } from "./cloudinary.js";

// ---------- Éléments du DOM ----------
const blocAuth = document.getElementById("bloc-auth");
const blocProfil = document.getElementById("bloc-profil");
const messageAuth = document.getElementById("message-auth");

const formConnexion = document.getElementById("form-connexion");
const formInscription = document.getElementById("form-inscription");
const lienBasculer = document.getElementById("lien-basculer");
const titreAuth = document.getElementById("titre-auth");

const formDemande = document.getElementById("form-demande-vendeur");
const messageDemande = document.getElementById("message-demande");
const blocDevenirVendeur = document.getElementById("bloc-devenir-vendeur");
const boutonPosition = document.getElementById("bouton-position");
const positionResultat = document.getElementById("position-resultat");

const boutonModeManuel = document.getElementById("bouton-mode-manuel");
const boutonModeGps = document.getElementById("bouton-mode-gps");
const blocLocalisationManuelle = document.getElementById("bloc-localisation-manuelle");
const blocLocalisationGps = document.getElementById("bloc-localisation-gps");
const localisationTexte = document.getElementById("localisation-texte");

let modeLocalisation = "manuel";

let utilisateurConnecte = null;

// ---------- Bascule connexion / inscription ----------
lienBasculer.addEventListener("click", (e) => {
  e.preventDefault();
  const inscriptionVisible = formInscription.style.display !== "none";
  formInscription.style.display = inscriptionVisible ? "none" : "block";
  formConnexion.style.display = inscriptionVisible ? "block" : "none";
  titreAuth.textContent = inscriptionVisible ? "Connexion" : "Créer un compte";
  lienBasculer.textContent = inscriptionVisible
    ? "Pas encore de compte ? Inscris-toi"
    : "Déjà un compte ? Connecte-toi";
  messageAuth.innerHTML = "";
});

// ---------- Connexion ----------
formConnexion.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email-connexion").value;
  const mdp = document.getElementById("mdp-connexion").value;
  try {
    await connexion(email, mdp);
  } catch (err) {
    afficherMessage(messageAuth, traduireErreurFirebase(err.code), "erreur");
  }
});

// ---------- Inscription ----------
formInscription.addEventListener("submit", async (e) => {
  e.preventDefault();
  const nom = document.getElementById("nom-inscription").value;
  const email = document.getElementById("email-inscription").value;
  const mdp = document.getElementById("mdp-inscription").value;
  try {
    await inscription(nom, email, mdp);
  } catch (err) {
    afficherMessage(messageAuth, traduireErreurFirebase(err.code), "erreur");
  }
});

// ---------- Déconnexion ----------
document.getElementById("bouton-deconnexion").addEventListener("click", async () => {
  await deconnexion();
});

// ---------- Bascule saisie manuelle / GPS pour la localisation ----------
function definirModeLocalisation(mode) {
  modeLocalisation = mode;
  const estManuel = mode === "manuel";
  blocLocalisationManuelle.style.display = estManuel ? "block" : "none";
  blocLocalisationGps.style.display = estManuel ? "none" : "block";
  boutonModeManuel.classList.toggle("secondaire", !estManuel);
  boutonModeGps.classList.toggle("secondaire", true);
  localisationTexte.required = estManuel;
}
boutonModeManuel.addEventListener("click", () => definirModeLocalisation("manuel"));
boutonModeGps.addEventListener("click", () => definirModeLocalisation("gps"));
definirModeLocalisation("manuel");

// ---------- Afficher / masquer le mot de passe (icône œil) ----------
document.querySelectorAll(".bouton-oeil").forEach((bouton) => {
  bouton.addEventListener("click", () => {
    const champ = document.getElementById(bouton.dataset.cible);
    const visible = champ.type === "text";
    champ.type = visible ? "password" : "text";
    bouton.textContent = visible ? "👁️" : "🙈";
  });
});

// ---------- Géolocalisation exacte ----------
boutonPosition.addEventListener("click", () => {
  if (!navigator.geolocation) {
    positionResultat.textContent = "La géolocalisation n'est pas supportée par ton navigateur.";
    return;
  }
  positionResultat.textContent = "Localisation en cours...";
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      document.getElementById("position-lat").value = lat;
      document.getElementById("position-lng").value = lng;
      positionResultat.textContent = `Position enregistrée : ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    },
    () => {
      positionResultat.textContent = "Impossible de récupérer ta position. Vérifie les autorisations de localisation.";
    },
    { enableHighAccuracy: true }
  );
});

// ---------- Envoi de la demande vendeur ----------
formDemande.addEventListener("submit", async (e) => {
  e.preventDefault();

  let position;
  if (modeLocalisation === "manuel") {
    const texte = localisationTexte.value.trim();
    if (!texte) {
      afficherMessage(messageDemande, "Merci de renseigner ta localisation.", "erreur");
      return;
    }
    position = { texte };
  } else {
    const lat = document.getElementById("position-lat").value;
    const lng = document.getElementById("position-lng").value;
    if (!lat || !lng) {
      afficherMessage(messageDemande, "Merci d'utiliser le bouton pour récupérer ta position GPS.", "erreur");
      return;
    }
    position = { lat: Number(lat), lng: Number(lng) };
  }

  const anciennete = Number(document.getElementById("anciennete").value);
  if (!anciennete || anciennete < 1) {
    afficherMessage(messageDemande, "Merci de renseigner un nombre d'années valide.", "erreur");
    return;
  }

  if (!document.getElementById("accepte-responsabilite").checked) {
    afficherMessage(messageDemande, "Merci de cocher la case de responsabilité pour continuer.", "erreur");
    return;
  }

  const donnees = {
    uid: utilisateurConnecte.uid,
    specialite: document.getElementById("specialite").value,
    anciennete: anciennete,
    telephone: document.getElementById("telephone-demande").value,
    description: document.getElementById("description-demande").value,
    position: position,
    engagementResponsabilite: true,
    statut: "en_attente",
    dateEnvoi: new Date().toISOString()
  };

  const boutonEnvoyer = document.getElementById("bouton-envoyer-demande");
  boutonEnvoyer.disabled = true;

  try {
    await addDoc(collection(db, "demandesVendeur"), donnees);
    afficherMessage(messageDemande, "Ta demande a été envoyée. Tu seras notifié après examen.", "succes");
    formDemande.reset();
    positionResultat.textContent = "";
    definirModeLocalisation("manuel");
    afficherStatutVendeur("en_attente");
    formDemande.style.display = "none";
  } catch (err) {
    afficherMessage(messageDemande, "Erreur lors de l'envoi. Réessaie.", "erreur");
    boutonEnvoyer.disabled = false;
  }
});

// ---------- Écoute de l'état de connexion ----------
surChangementAuth(async (utilisateur) => {
  utilisateurConnecte = utilisateur;

  if (!utilisateur) {
    blocAuth.style.display = "block";
    blocProfil.style.display = "none";
    return;
  }

  blocAuth.style.display = "none";
  blocProfil.style.display = "block";

  const profil = await recupererProfil(utilisateur.uid);
  if (!profil) return;

  document.getElementById("profil-nom").textContent = profil.nom;
  document.getElementById("profil-email").textContent = profil.email;
  afficherAvatar(profil.nom, profil.photoUrl);

  // Vérifie s'il existe déjà une demande vendeur pour cet utilisateur
  const statutReel = await recupererStatutDemande(utilisateur.uid, profil.statutVendeur);
  afficherStatutVendeur(statutReel);
});

// Cherche la demande la plus récente de l'utilisateur dans "demandesVendeur"
async function recupererStatutDemande(uid, statutParDefaut) {
  const q = query(collection(db, "demandesVendeur"), where("uid", "==", uid));
  const resultats = await getDocs(q);
  if (resultats.empty) return statutParDefaut || "aucun";
  // On prend la demande la plus récente
  let derniere = null;
  resultats.forEach((docSnap) => {
    const d = docSnap.data();
    if (!derniere || d.dateEnvoi > derniere.dateEnvoi) derniere = d;
  });
  return derniere.statut;
}

// Met à jour le badge de statut + cache/affiche le formulaire de demande
function afficherStatutVendeur(statut) {
  const badge = document.getElementById("badge-statut");
  const classes = { aucun: "", en_attente: "attente", valide: "valide", refuse: "refuse" };
  const labels = {
    aucun: "Acheteur",
    en_attente: "Demande en cours d'examen",
    valide: "Vendeur validé",
    refuse: "Demande refusée"
  };
  badge.className = "statut-badge " + (classes[statut] || "");
  badge.textContent = labels[statut] || "Acheteur";

  // On cache tout le bloc "Devenir vendeur" une fois le compte validé
  if (statut === "valide") {
    blocDevenirVendeur.style.display = "none";
  } else {
    blocDevenirVendeur.style.display = "block";
    // On cache seulement le formulaire si une demande est déjà en cours
    formDemande.style.display = (statut === "en_attente") ? "none" : "block";
  }
}

// Affiche la photo de profil, ou l'initiale du nom s'il n'y a pas de photo
function afficherAvatar(nom, photoUrl) {
  const avatar = document.getElementById("avatar-initiale");
  if (photoUrl && String(photoUrl).startsWith("https://")) {
    avatar.textContent = "";
    avatar.style.backgroundImage = `url("${String(photoUrl).replace(/"/g, "%22")}")`;
    avatar.style.backgroundSize = "cover";
    avatar.style.backgroundPosition = "center";
  } else {
    avatar.style.backgroundImage = "none";
    avatar.textContent = String(nom || "?").charAt(0).toUpperCase();
  }
}

// ---------- Changer la photo de profil ----------
const champPhoto = document.getElementById("photo-profil");
const messagePhoto = document.getElementById("message-photo");

champPhoto.addEventListener("change", async () => {
  const fichier = champPhoto.files[0];
  if (!fichier || !utilisateurConnecte) return;

  if (fichier.size > 2 * 1024 * 1024) {
    afficherMessage(messagePhoto, "La photo dépasse 2 Mo. Choisis une image plus légère.", "erreur");
    champPhoto.value = "";
    return;
  }

  afficherMessage(messagePhoto, "Envoi de la photo...", "succes");
  try {
    const url = await envoyerImage(fichier, "profils");
    await updateDoc(doc(db, "utilisateurs", utilisateurConnecte.uid), { photoUrl: url });
    afficherAvatar(document.getElementById("profil-nom").textContent, url);
    afficherMessage(messagePhoto, "Photo mise à jour.", "succes");
  } catch (err) {
    console.error("Erreur photo de profil :", err);
    afficherMessage(
      messagePhoto,
      err.code === "permission-denied"
        ? "Modification refusée par les règles Firestore."
        : "Impossible d'envoyer la photo. Réessaie.",
      "erreur"
    );
  }
  champPhoto.value = "";
});

function afficherMessage(conteneur, texte, type) {
  conteneur.innerHTML = `<div class="message ${type}">${texte}</div>`;
}
