// ===========================================================
// profil.js — logique de la page profil.html
// ===========================================================

import { sb, ok, snake, estRefuse } from "./supabase-config.js";
import {
  inscription, connexion, deconnexion, inscriptionParNom, connexionParNom, connexionSociale,
  envoyerLienReinitialisation, changerMotDePasse, surRecuperationMotDePasse,
  recupererProfil, surChangementAuth, traduireErreur, enregistrerAcceptation,
  ajouterEmailRecuperation, estEmailInterne
} from "./auth.js";
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

// ---------- Anti-robot (Cloudflare Turnstile) ----------
// Colle ici ta « Site key » Turnstile (la clé publique). Tant qu'elle n'est pas remplie,
// le captcha est désactivé côté site.
const CAPTCHA_SITE_KEY = "COLLE-ICI-TA-CLE-SITE-TURNSTILE";
const captchaActif = !CAPTCHA_SITE_KEY.startsWith("COLLE-ICI");
let captchaWidgetId = null;

function monterCaptcha() {
  if (!captchaActif) { document.getElementById("captcha-box").style.display = "none"; return; }
  if (!window.turnstile) { setTimeout(monterCaptcha, 300); return; }   // script pas encore chargé
  captchaWidgetId = window.turnstile.render("#captcha-box", { sitekey: CAPTCHA_SITE_KEY, language: "fr" });
}
function jetonCaptcha() {
  if (!captchaActif) return undefined;
  const jeton = window.turnstile && window.turnstile.getResponse(captchaWidgetId);
  if (!jeton) throw Object.assign(new Error("Captcha requis"), { code: "captcha_requis" });
  return jeton;
}
function renouvelerCaptcha() {
  if (captchaActif && window.turnstile) window.turnstile.reset(captchaWidgetId);   // un jeton ne sert qu'une fois
}
monterCaptcha();

// ---------- Méthodes de connexion : nom + code, ou email ----------
const formNom = document.getElementById("form-nom");
const blocEmail = document.getElementById("bloc-email");
const formOubli = document.getElementById("form-oubli");
const blocNouveauMdp = document.getElementById("bloc-nouveau-mdp");
const messageNouveauMdp = document.getElementById("message-nouveau-mdp");

let methode = "nom";      // "nom" ou "email"
let inscrire = false;     // false = connexion, true = création de compte
let enRecuperation = false;

function majAffichageAuth() {
  const estNom = methode === "nom";
  document.getElementById("onglet-nom").classList.toggle("secondaire", !estNom);
  document.getElementById("onglet-email").classList.toggle("secondaire", estNom);
  formNom.style.display = estNom ? "block" : "none";
  blocEmail.style.display = estNom ? "none" : "block";
  formConnexion.style.display = (!estNom && !inscrire) ? "block" : "none";
  formInscription.style.display = (!estNom && inscrire) ? "block" : "none";
  formOubli.style.display = "none";
  document.getElementById("bouton-nom").textContent = inscrire ? "Créer mon compte" : "Se connecter";
  document.getElementById("code-simple").autocomplete = inscrire ? "new-password" : "current-password";
  titreAuth.textContent = inscrire ? "Créer un compte" : "Connexion";
  lienBasculer.textContent = inscrire ? "Déjà un compte ? Connecte-toi" : "Pas encore de compte ? Inscris-toi";
  lienBasculer.parentElement.style.display = "block";
  messageAuth.innerHTML = "";
}

document.getElementById("onglet-nom").addEventListener("click", () => { methode = "nom"; majAffichageAuth(); });
document.getElementById("onglet-email").addEventListener("click", () => { methode = "email"; majAffichageAuth(); });
lienBasculer.addEventListener("click", (e) => { e.preventDefault(); inscrire = !inscrire; majAffichageAuth(); });
majAffichageAuth();

// ---------- Connexion / inscription avec NOM + CODE ----------
formNom.addEventListener("submit", async (e) => {
  e.preventDefault();
  const nom = document.getElementById("nom-simple").value;
  const code = document.getElementById("code-simple").value;
  const bouton = document.getElementById("bouton-nom");
  if (code.length < 6) {
    afficherMessage(messageAuth, "Le code doit contenir au moins 6 caractères.", "erreur");
    return;
  }
  bouton.disabled = true;
  try {
    const jeton = jetonCaptcha();
    if (inscrire) await inscriptionParNom(nom, code, jeton);
    else await connexionParNom(nom, code, jeton);
  } catch (err) {
    console.error("Nom + code :", err.code, err.message);
    afficherMessage(messageAuth, traduireErreur(err, "nom"), "erreur");
    renouvelerCaptcha();
  }
  bouton.disabled = false;
});

// ---------- Connexion avec EMAIL ----------
formConnexion.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email-connexion").value;
  const mdp = document.getElementById("mdp-connexion").value;
  try {
    await connexion(email, mdp, jetonCaptcha());
  } catch (err) {
    afficherMessage(messageAuth, traduireErreur(err), "erreur");
    renouvelerCaptcha();
  }
});

// ---------- Inscription avec EMAIL ----------
formInscription.addEventListener("submit", async (e) => {
  e.preventDefault();
  const nom = document.getElementById("nom-inscription").value;
  const email = document.getElementById("email-inscription").value;
  const mdp = document.getElementById("mdp-inscription").value;
  try {
    await inscription(nom, email, mdp, jetonCaptcha());
  } catch (err) {
    afficherMessage(messageAuth, traduireErreur(err), "erreur");
    renouvelerCaptcha();
  }
});

// ---------- Google et Facebook ----------
async function connecterAvec(fournisseur) {
  try {
    await connexionSociale(fournisseur);   // la page part chez Google / Facebook puis revient ici
  } catch (err) {
    console.error("Connexion " + fournisseur + " :", err);
    afficherMessage(messageAuth, "Cette connexion n'est pas disponible pour l'instant. Utilise ton nom ou ton email.", "erreur");
  }
}
document.getElementById("bouton-google").addEventListener("click", () => connecterAvec("google"));
document.getElementById("bouton-facebook").addEventListener("click", () => connecterAvec("facebook"));

// ---------- Mot de passe oublié ----------
document.getElementById("lien-oubli").addEventListener("click", (e) => {
  e.preventDefault();
  formConnexion.style.display = "none";
  formOubli.style.display = "block";
  lienBasculer.parentElement.style.display = "none";
  messageAuth.innerHTML = "";
  document.getElementById("email-oubli").value = document.getElementById("email-connexion").value;
});
document.getElementById("lien-retour-connexion").addEventListener("click", (e) => {
  e.preventDefault();
  majAffichageAuth();
});
formOubli.addEventListener("submit", async (e) => {
  e.preventDefault();
  const bouton = formOubli.querySelector("button[type=submit]");
  bouton.disabled = true;
  try {
    await envoyerLienReinitialisation(document.getElementById("email-oubli").value, "profil.html", jetonCaptcha());
    afficherMessage(messageAuth, "Si cet email a un compte, un lien vient d'être envoyé. Pense à regarder aussi les spams.", "succes");
  } catch (err) {
    afficherMessage(messageAuth, traduireErreur(err), "erreur");
  }
  renouvelerCaptcha();
  bouton.disabled = false;
});

// ---------- Nouveau mot de passe (arrivée depuis le lien reçu par email) ----------
surRecuperationMotDePasse(() => {
  enRecuperation = true;
  blocAuth.style.display = "none";
  blocProfil.style.display = "none";
  blocNouveauMdp.style.display = "block";
});
document.getElementById("form-nouveau-mdp").addEventListener("submit", async (e) => {
  e.preventDefault();
  const bouton = e.target.querySelector("button[type=submit]");
  bouton.disabled = true;
  try {
    await changerMotDePasse(document.getElementById("nouveau-mdp").value);
    afficherMessage(messageNouveauMdp, "Mot de passe changé ✓ Tu es connecté.", "succes");
    setTimeout(() => { window.location.href = "profil.html"; }, 1200);
  } catch (err) {
    afficherMessage(messageNouveauMdp, traduireErreur(err), "erreur");
    bouton.disabled = false;
  }
});

// ---------- Ajouter un vrai email (comptes créés avec nom + code) ----------
document.getElementById("form-ajout-email").addEventListener("submit", async (e) => {
  e.preventDefault();
  const bouton = e.target.querySelector("button[type=submit]");
  const zone = document.getElementById("message-ajout-email");
  bouton.disabled = true;
  try {
    await ajouterEmailRecuperation(document.getElementById("email-ajout").value);
    afficherMessage(zone, "Un lien de confirmation vient d'être envoyé à cet email. Clique dessus pour valider (regarde aussi les spams).", "succes");
  } catch (err) {
    console.error("Ajout email :", err.code, err.message);
    afficherMessage(zone, traduireErreur(err), "erreur");
  }
  bouton.disabled = false;
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
    engagementResponsabilite: true
  };

  const boutonEnvoyer = document.getElementById("bouton-envoyer-demande");
  boutonEnvoyer.disabled = true;

  try {
    ok(await sb.from("demandes_vendeur").insert(snake(donnees)));
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
  if (enRecuperation) return;   // la personne est en train de choisir un nouveau mot de passe

  if (!utilisateur) {
    blocAuth.style.display = "block";
    blocProfil.style.display = "none";
    return;
  }

  blocAuth.style.display = "none";
  blocProfil.style.display = "block";

  const profil = await recupererProfil(utilisateur.uid);
  if (!profil) return;
  enregistrerAcceptation(profil);   // garde la date d'acceptation des conditions

  document.getElementById("profil-nom").textContent = profil.nom;
  const emailInterne = estEmailInterne(profil.email);
  document.getElementById("profil-email").textContent = emailInterne ? "" : profil.email;
  document.getElementById("bloc-ajout-email").style.display = emailInterne ? "block" : "none";
  afficherAvatar(profil.nom, profil.photoUrl);

  // Vérifie s'il existe déjà une demande vendeur pour cet utilisateur
  const statutReel = await recupererStatutDemande(utilisateur.uid, profil.statutVendeur);
  afficherStatutVendeur(statutReel);
});

// Cherche la demande la plus récente de l'utilisateur dans "demandesVendeur"
async function recupererStatutDemande(uid, statutParDefaut) {
  const lignes = ok(
    await sb.from("demandes_vendeur").select("statut").eq("uid", uid).order("date_envoi", { ascending: false }).limit(1)
  );
  if (lignes.length === 0) return statutParDefaut || "aucun";
  // La demande la plus récente
  return lignes[0].statut;
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
    const lignes = ok(await sb.from("utilisateurs").update({ photo_url: url }).eq("id", utilisateurConnecte.uid).select("id"));
    if (!lignes.length) throw Object.assign(new Error("refusé"), { code: "42501" });
    afficherAvatar(document.getElementById("profil-nom").textContent, url);
    afficherMessage(messagePhoto, "Photo mise à jour.", "succes");
  } catch (err) {
    console.error("Erreur photo de profil :", err);
    afficherMessage(
      messagePhoto,
      estRefuse(err)
        ? "Modification refusée."
        : "Impossible d'envoyer la photo. Réessaie.",
      "erreur"
    );
  }
  champPhoto.value = "";
});

function afficherMessage(conteneur, texte, type) {
  conteneur.innerHTML = `<div class="message ${type}">${texte}</div>`;
}
