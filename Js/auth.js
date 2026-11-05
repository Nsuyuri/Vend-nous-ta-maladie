// ===========================================================
// auth.js
// Toute la logique liée aux comptes utilisateurs (Supabase).
// ===========================================================

import { sb, auth, ok, camel, surChangementAuth, surRecuperationMotDePasse } from "./supabase-config.js";

export { surChangementAuth, surRecuperationMotDePasse };

// Crée un compte. Le profil (rôle « acheteur ») est créé automatiquement par la base.
export async function inscription(nom, email, motDePasse) {
  const { data, error } = await sb.auth.signUp({
    email,
    password: motDePasse,
    options: { data: { nom: nom.trim() } }
  });
  if (error) throw error;

  // Si Supabase exige encore la confirmation par email, il n'y a pas de session
  if (!data.session) {
    const e = new Error("Confirmation requise");
    e.code = "confirmation_requise";
    throw e;
  }
  return auth.currentUser;
}

export async function connexion(email, motDePasse) {
  const { error } = await sb.auth.signInWithPassword({ email, password: motDePasse });
  if (error) throw error;
  return auth.currentUser;
}

export async function deconnexion() {
  await sb.auth.signOut();
}

// Envoie un email avec un lien pour choisir un nouveau mot de passe
export async function envoyerLienReinitialisation(email, pageRetour = "profil.html") {
  const { error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: new URL(pageRetour, window.location.href).href
  });
  if (error) throw error;
}

// À appeler quand la personne revient avec le lien reçu par email
export async function changerMotDePasse(nouveauMotDePasse) {
  const { error } = await sb.auth.updateUser({ password: nouveauMotDePasse });
  if (error) throw error;
}

// Récupère le profil de l'utilisateur (table « utilisateurs »)
export async function recupererProfil(uid) {
  const ligne = ok(await sb.from("utilisateurs").select("*").eq("id", uid).maybeSingle());
  if (ligne) return camel(ligne);

  // Profil absent (supprimé par erreur) : on le recrée avec le rôle le plus prudent
  const u = auth.currentUser;
  if (!u || u.uid !== uid) return null;

  const nom = u.displayName || (u.email ? u.email.split("@")[0] : "Utilisateur");
  const { error } = await sb.from("utilisateurs").insert({ id: uid, nom, email: u.email || "" });
  if (error && error.code !== "23505") console.error("Impossible de recréer le profil :", error);

  const apres = ok(await sb.from("utilisateurs").select("*").eq("id", uid).maybeSingle());
  return apres ? camel(apres) : {
    id: uid, nom, email: u.email || "", role: "acheteur",
    statutVendeur: "aucun", dateCreation: new Date().toISOString()
  };
}

// ---------- Connexion par NOM + CODE (sans email) ----------
// Le nom devient un email interne invisible (Supabase en exige un).
// Attention : sans vrai email, le « mot de passe oublié » n'est pas possible pour ces comptes.

const DOMAINE_INTERNE = "vendnoustamaladie.app";

export function nomVersEmail(nom) {
  const propre = String(nom || "").trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
  return propre ? `${propre}@${DOMAINE_INTERNE}` : "";
}

export async function inscriptionParNom(nom, code) {
  const email = nomVersEmail(nom);
  if (!email) throw Object.assign(new Error("Nom invalide"), { code: "nom_invalide" });
  return inscription(nom, email, code);
}

export async function connexionParNom(nom, code) {
  const email = nomVersEmail(nom);
  if (!email) throw Object.assign(new Error("Nom invalide"), { code: "nom_invalide" });
  return connexion(email, code);
}

// ---------- Connexion avec Google ou Facebook ----------
// provider : "google" ou "facebook". La page se recharge après la connexion.
export async function connexionSociale(provider) {
  const { error } = await sb.auth.signInWithOAuth({
    provider,
    options: { redirectTo: new URL("profil.html", window.location.href).href }
  });
  if (error) throw error;
}

// ---------- Acceptation des conditions : on garde la date dans la base ----------
export async function enregistrerAcceptation(profil) {
  try {
    const c = JSON.parse(localStorage.getItem("vnm_consent"));
    if (!c || !c.version || !profil || profil.conditionsVersion === c.version) return;
    await sb.from("utilisateurs")
      .update({ conditions_version: c.version, conditions_acceptees_le: c.date || new Date().toISOString() })
      .eq("id", profil.id);
  } catch (e) { /* pas grave : on réessaiera à la prochaine visite */ }
}

// Vrai si le profil est celui d'un vendeur validé
export function estVendeurValide(profil) {
  return !!profil && (profil.role === "vendeur" || profil.statutVendeur === "valide");
}

// Traduit une erreur Supabase en message compréhensible
export function traduireErreur(err) {
  const code = err?.code || "";
  const texte = String(err?.message || "");

  if (code === "confirmation_requise")
    return "Compte créé. Vérifie ta boîte mail et clique sur le lien de confirmation, puis connecte-toi.";
  if (code === "nom_invalide")
    return "Écris ton nom (lettres ou chiffres).";
  if (code === "user_already_exists" || code === "email_exists" || /already registered/i.test(texte))
    return "Cet email ou ce nom est déjà utilisé. Pour un nom, ajoute un chiffre (ex : Jean2).";
  if (code === "weak_password" || /at least \d+ characters|password should/i.test(texte))
    return "Le mot de passe doit contenir au moins 6 caractères.";
  if (code === "invalid_credentials" || /invalid login credentials/i.test(texte))
    return "Nom, email ou mot de passe incorrect.";
  if (code === "email_not_confirmed" || /email not confirmed/i.test(texte))
    return "Confirme d'abord ton email avec le lien reçu par mail.";
  if (code === "validation_failed" || /invalid.*email|email.*invalid/i.test(texte))
    return "L'adresse email n'est pas valide.";
  if (code === "over_request_rate_limit" || code === "over_email_send_rate_limit" || /rate limit/i.test(texte))
    return "Trop de tentatives. Attends quelques minutes puis réessaie.";
  if (!navigator.onLine || /fetch|network/i.test(texte))
    return "Pas de connexion internet.";
  return "Une erreur est survenue. Réessaie.";
}
