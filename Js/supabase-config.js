// ===========================================================
// supabase-config.js
// Connexion à Supabase + petits outils partagés par toutes les pages.
// Remplace firebase-config.js.
//
// 1. Va dans Supabase > Project Settings > API
// 2. Copie « Project URL » et la clé « anon public » ci-dessous.
//    (La clé anon peut être publique : la sécurité vient des règles RLS du fichier supabase.sql.)
// ===========================================================

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";

const SUPABASE_URL = "https://fjakkjqidkiaiblwgflw.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqYWtranFpZGtpYWlibHdnZmx3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM2OTk3NjYsImV4cCI6MjEwOTI3NTc2Nn0.mPCGQFbzbVrTe1L6fwjO8oHMk-WoyTvZ4YivRfP-BlQ";

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

// ---------- Noms de colonnes : base (snake_case) <-> site (camelCase) ----------
// Le reste du site garde ses noms habituels (dateCreation, vendeurUid...).

const versCamel = (cle) => cle.replace(/_([a-z])/g, (_, l) => l.toUpperCase());
const versSnake = (cle) => cle.replace(/[A-Z]/g, (l) => "_" + l.toLowerCase());

export function camel(ligne) {
  if (!ligne || typeof ligne !== "object") return ligne;
  const sortie = {};
  for (const cle of Object.keys(ligne)) sortie[versCamel(cle)] = ligne[cle];
  return sortie;
}
export const camelListe = (lignes) => (lignes || []).map(camel);

export function snake(objet) {
  const sortie = {};
  for (const cle of Object.keys(objet)) sortie[versSnake(cle)] = objet[cle];
  return sortie;
}

// Lance une erreur si Supabase en renvoie une, sinon rend les données
export function ok(reponse) {
  if (reponse.error) throw reponse.error;
  return reponse.data;
}

// Vrai si Supabase a refusé l'action à cause des règles de sécurité
export function estRefuse(err) {
  return !!err && (err.code === "42501" || /row-level security|permission denied/i.test(err.message || ""));
}

// Vrai si l'erreur vient d'une coupure de connexion
function estErreurReseau(err) {
  return !navigator.onLine || (!err?.code && /fetch|network|load failed/i.test(err?.message || ""));
}

// ---------- Utilisateur connecté (même forme qu'avant : uid, email, displayName) ----------

function versUtilisateur(session) {
  const u = session?.user;
  if (!u) return null;
  return { uid: u.id, email: u.email || "", displayName: u.user_metadata?.nom || "" };
}

let signalPrete;
const prete = new Promise((r) => { signalPrete = r; });

export const auth = {
  currentUser: null,
  authStateReady: () => prete
};

sb.auth.getSession().then(({ data }) => {
  auth.currentUser = versUtilisateur(data.session);
  signalPrete();
}).catch(() => signalPrete());

const ecouteurs = new Set();
let dernierUid;   // undefined = pas encore annoncé

function annoncer(utilisateur) {
  const uid = utilisateur ? utilisateur.uid : null;
  if (uid === dernierUid) return;           // évite les doublons (retour sur l'onglet, etc.)
  dernierUid = uid;
  ecouteurs.forEach((cb) => setTimeout(() => cb(utilisateur), 0));
}

sb.auth.onAuthStateChange((_evenement, session) => {
  auth.currentUser = versUtilisateur(session);
  if (dernierUid !== undefined) annoncer(auth.currentUser);
});

// Appelle `callback` une fois au chargement, puis à chaque connexion / déconnexion
export function surChangementAuth(callback) {
  ecouteurs.add(callback);
  prete.then(() => {
    if (dernierUid === undefined) dernierUid = auth.currentUser ? auth.currentUser.uid : null;
    setTimeout(() => callback(auth.currentUser), 0);
  });
}

// Appelle `callback` quand la personne revient avec le lien « mot de passe oublié » reçu par email
export function surRecuperationMotDePasse(callback) {
  sb.auth.onAuthStateChange((evenement) => {
    if (evenement === "PASSWORD_RECOVERY") setTimeout(callback, 0);
  });
}

// ---------- Commandes : file d'attente si le réseau est coupé ----------

const CLE_FILE = "commandes_en_attente_vntm";

function lireFile() {
  try { return JSON.parse(localStorage.getItem(CLE_FILE)) || []; } catch { return []; }
}
function ecrireFile(liste) {
  try { localStorage.setItem(CLE_FILE, JSON.stringify(liste)); } catch {}
}

// Rend "envoyee" ou "en_attente_reseau". Les autres erreurs sont relancées.
export async function envoyerCommande(commande) {
  try {
    ok(await sb.from("commandes").insert(snake(commande)));
    return "envoyee";
  } catch (err) {
    if (estErreurReseau(err)) {
      ecrireFile([...lireFile(), commande]);
      return "en_attente_reseau";
    }
    throw err;
  }
}

let renvoiEnCours = false;
export async function renvoyerCommandesEnAttente() {
  if (renvoiEnCours || !navigator.onLine) return;
  const file = lireFile();
  if (!file.length) return;
  await prete;
  renvoiEnCours = true;
  const reste = [];
  for (const commande of file) {
    // Commande d'un compte : on attend que ce compte soit connecté. Commande visiteur : on l'envoie.
    if (commande.acheteurUid && commande.acheteurUid !== auth.currentUser?.uid) { reste.push(commande); continue; }
    try {
      ok(await sb.from("commandes").insert(snake(commande)));
    } catch (err) {
      if (estErreurReseau(err) || estRefuse(err)) reste.push(commande);
      else console.error("Commande abandonnée :", err);
    }
  }
  ecrireFile(reste);
  renvoiEnCours = false;
}

window.addEventListener("online", () => renvoyerCommandesEnAttente());
renvoyerCommandesEnAttente();
