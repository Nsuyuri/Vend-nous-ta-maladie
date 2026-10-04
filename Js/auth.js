// ===========================================================
// auth.js
// Toute la logique liée aux comptes utilisateurs.
// ===========================================================

import { auth, db } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  doc, setDoc, getDoc
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// Crée un compte + un document utilisateur dans Firestore
export async function inscription(nom, email, motDePasse) {
  const identifiants = await createUserWithEmailAndPassword(auth, email, motDePasse);
  const uid = identifiants.user.uid;

  // Document de profil, avec un rôle par défaut "acheteur"
  await setDoc(doc(db, "utilisateurs", uid), {
    nom: nom,
    email: email,
    role: "acheteur",          // acheteur | vendeur | admin
    statutVendeur: "aucun",    // aucun | en_attente | valide | refuse
    dateCreation: new Date().toISOString()
  });

  return identifiants.user;
}

export async function connexion(email, motDePasse) {
  const identifiants = await signInWithEmailAndPassword(auth, email, motDePasse);
  return identifiants.user;
}

export async function deconnexion() {
  await signOut(auth);
}

// Récupère le document Firestore correspondant à l'utilisateur connecté
export async function recupererProfil(uid) {
  const snap = await getDoc(doc(db, "utilisateurs", uid));
  return snap.exists() ? snap.data() : null;
}

// Écoute les changements de connexion (appelée sur chaque page)
export function surChangementAuth(callback) {
  onAuthStateChanged(auth, callback);
}

// Traduit un code d'erreur Firebase en message compréhensible
export function traduireErreurFirebase(code) {
  const messages = {
    "auth/email-already-in-use": "Cet email est déjà utilisé.",
    "auth/invalid-email": "L'adresse email n'est pas valide.",
    "auth/weak-password": "Le mot de passe doit contenir au moins 6 caractères.",
    "auth/user-not-found": "Aucun compte ne correspond à cet email.",
    "auth/wrong-password": "Mot de passe incorrect.",
    "auth/invalid-credential": "Email ou mot de passe incorrect."
  };
  return messages[code] || "Une erreur est survenue. Réessaie.";
}
