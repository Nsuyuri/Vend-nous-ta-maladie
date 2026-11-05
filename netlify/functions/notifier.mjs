// ===========================================================
// Fonction Netlify : envoie les notifications push
//  - nouvelle commande         → chaque vendeur concerné
//  - nouvelle demande vendeur  → les admins
//  - nouvel article en attente → les admins
//
// Supabase appelle cette fonction à chaque nouvelle ligne
// (voir notifications-netlify.sql). Aucun serveur à garder allumé.
//
// Variables Netlify : voir VARIABLES-NETLIFY.txt
// ===========================================================
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { timingSafeEqual } from "node:crypto";

// Clé publique : elle peut être visible (la même que dans Js/notifications.js)
const VAPID_PUBLIC_KEY = "BJ4qwWmHpkEfuzu9nS8WInxNCcHqaKcdh8FaCg0WWQWKJBgGjkTxUGSBflGAfFPndod2wLys19OZpTUjy5pm8UE";

function memeSecret(recu, attendu) {
  const a = Buffer.from(String(recu || ""));
  const b = Buffer.from(String(attendu || ""));
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

const reponse = (texte, statut = 200) => new Response(texte, { status: statut });

export default async (req) => {
  if (req.method !== "POST") return reponse("Méthode refusée", 405);

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VAPID_PRIVATE_KEY, WEBHOOK_SECRET } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !VAPID_PRIVATE_KEY || !WEBHOOK_SECRET) {
    console.error("Variables Netlify manquantes");
    return reponse("Configuration incomplète", 500);
  }
  if (!memeSecret(req.headers.get("x-webhook-secret"), WEBHOOK_SECRET)) {
    return reponse("Non autorisé", 401);
  }

  let evenement;
  try { evenement = await req.json(); } catch { return reponse("Corps invalide", 400); }
  const table = evenement?.table;
  const ligne = evenement?.record || {};

  const site = (process.env.URL || new URL(req.url).origin).replace(/\/$/, "");
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  webpush.setVapidDetails(site.startsWith("https://") ? site : "mailto:contact@vendnoustamaladie.app", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  async function uidsAdmins() {
    const { data, error } = await sb.from("utilisateurs").select("id").eq("role", "admin");
    if (error) throw error;
    return data.map((u) => u.id);
  }

  // Qui prévenir, et avec quel message
  let destinataires = [];
  let message;
  if (table === "commandes") {
    destinataires = ligne.vendeur_uids || [];
    message = {
      titre: "Nouvelle commande 🛒",
      corps: `${ligne.nom || "Un client"} : ${Number(ligne.total || 0).toLocaleString("fr-FR")} FCFA`,
      lien: "/profil.html"
    };
  } else if (table === "demandes_vendeur") {
    destinataires = await uidsAdmins();
    message = { titre: "Nouvelle demande vendeur 🧑‍⚕️", corps: ligne.specialite || "Une personne veut devenir vendeur", lien: "/admin.html" };
  } else if (table === "articles") {
    destinataires = await uidsAdmins();
    message = { titre: "Nouvel article à valider 📝", corps: ligne.titre || "Un article attend ta validation", lien: "/admin.html" };
  } else {
    return reponse("Table ignorée");
  }

  if (!destinataires.length) return reponse("Personne à prévenir");

  const { data: appareils, error } = await sb
    .from("push_abonnements")
    .select("id, endpoint, cle_p256dh, cle_auth")
    .in("user_id", destinataires);
  if (error) { console.error(error.message); return reponse("Erreur base", 500); }
  if (!appareils.length) return reponse("Aucun appareil enregistré");

  const contenu = JSON.stringify({ titre: message.titre, corps: message.corps, lien: site + message.lien });
  let envoyees = 0;
  await Promise.all(appareils.map(async (a) => {
    try {
      await webpush.sendNotification(
        { endpoint: a.endpoint, keys: { p256dh: a.cle_p256dh, auth: a.cle_auth } },
        contenu,
        { TTL: 86400, urgency: "high" }
      );
      envoyees++;
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) {
        await sb.from("push_abonnements").delete().eq("id", a.id);   // appareil disparu
      } else {
        console.error("Envoi impossible :", e.statusCode || "", e.body || e.message);
      }
    }
  }));

  console.log(`${envoyees}/${appareils.length} notification(s) : ${message.titre}`);
  return reponse(`${envoyees}/${appareils.length} envoyée(s)`);
};
