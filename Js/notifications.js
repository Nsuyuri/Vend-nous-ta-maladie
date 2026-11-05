// ===========================================================
// notifications.js : notifications push (vendeurs + admin)
// Affiche sur profil.html une carte « Activer les notifications »
// pour les vendeurs validés et l'admin. L'appareil est enregistré
// dans Supabase (table push_abonnements) et le serveur Railway
// envoie les notifications, même quand le site est fermé.
// ===========================================================

import { sb, ok } from "./supabase-config.js";
import { recupererProfil, surChangementAuth } from "./auth.js";

// Clé publique (elle peut être visible). La clé privée reste sur Railway.
const VAPID_PUBLIC_KEY = "BJ4qwWmHpkEfuzu9nS8WInxNCcHqaKcdh8FaCg0WWQWKJBgGjkTxUGSBflGAfFPndod2wLys19OZpTUjy5pm8UE";

function cleVersOctets(base64url) {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const brut = atob(base64);
  return Uint8Array.from(brut, (c) => c.charCodeAt(0));
}

async function enregistrerAppareil() {
  const registration = await navigator.serviceWorker.ready;
  let abonnement = await registration.pushManager.getSubscription();

  if (!abonnement) {
    try {
      abonnement = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: cleVersOctets(VAPID_PUBLIC_KEY)
      });
    } catch (e) {
      // Ancien abonnement avec une autre clé : on repart de zéro
      const ancien = await registration.pushManager.getSubscription();
      if (ancien) await ancien.unsubscribe();
      abonnement = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: cleVersOctets(VAPID_PUBLIC_KEY)
      });
    }
  }

  const j = abonnement.toJSON();
  ok(await sb.rpc("enregistrer_abonnement_push", {
    p_endpoint: j.endpoint,
    p_p256dh: j.keys.p256dh,
    p_auth: j.keys.auth
  }));
}

function creerCarte() {
  let carte = document.getElementById("carte-notifications");
  if (carte) return carte;
  carte = document.createElement("div");
  carte.id = "carte-notifications";
  carte.className = "carte-profil";
  const premiere = document.querySelector("#bloc-profil .carte-profil");
  if (premiere) premiere.after(carte);
  else document.getElementById("bloc-profil")?.prepend(carte);
  return carte;
}

function afficher(carte, titre, texte, boutonTexte, action) {
  carte.innerHTML = `
    <h2>${titre}</h2>
    <p style="color:var(--texte-doux); margin:8px 0 ${boutonTexte ? "14px" : "0"};">${texte}</p>
    ${boutonTexte ? `<button type="button" class="bouton" id="bouton-notifs">${boutonTexte}</button>` : ""}`;
  if (boutonTexte) carte.querySelector("#bouton-notifs").addEventListener("click", action);
}

async function preparer(utilisateur) {
  const profil = await recupererProfil(utilisateur.uid);
  if (!profil || (profil.role !== "vendeur" && profil.role !== "admin")) return;

  const carte = creerCarte();
  const estAdmin = profil.role === "admin";
  const quoi = estAdmin
    ? "les nouvelles demandes vendeur et les nouveaux articles"
    : "chaque nouvelle commande";

  const supporte = ("serviceWorker" in navigator) && ("PushManager" in window) && ("Notification" in window);
  if (!supporte) {
    afficher(carte, "🔔 Notifications",
      "Sur iPhone : ouvre le menu Partager de Safari, choisis « Sur l'écran d'accueil », puis ouvre le site depuis cette icône. Sur Android, utilise Chrome.");
    return;
  }

  if (Notification.permission === "denied") {
    afficher(carte, "🔔 Notifications bloquées",
      "Autorise les notifications pour ce site dans les réglages de ton navigateur, puis recharge la page.");
    return;
  }

  const activer = async () => {
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { await preparer(utilisateur); return; }
      await enregistrerAppareil();
      afficher(carte, "🔔 Notifications activées ✅", `Tu seras prévenu pour ${quoi}, même quand le site est fermé.`);
    } catch (e) {
      console.error("Notifications :", e);
      afficher(carte, "🔔 Notifications", "Impossible de les activer pour l'instant. Réessaie.", "Réessayer", activer);
    }
  };

  if (Notification.permission === "granted") {
    // Déjà autorisé : on rafraîchit l'enregistrement en silence
    try {
      await enregistrerAppareil();
      afficher(carte, "🔔 Notifications activées ✅", `Tu seras prévenu pour ${quoi}, même quand le site est fermé.`);
    } catch (e) {
      console.error("Notifications :", e);
      afficher(carte, "🔔 Notifications", "Réactive-les pour continuer à être prévenu.", "Activer", activer);
    }
    return;
  }

  afficher(carte, "🔔 Notifications", `Active-les pour être prévenu de ${quoi}, même quand le site est fermé.`, "Activer les notifications", activer);
}

surChangementAuth((u) => { if (u) preparer(u).catch((e) => console.error(e)); });
