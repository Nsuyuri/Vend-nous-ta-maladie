// ===========================================================
// firebase-config.js
// Remplace les valeurs ci-dessous par celles de TON projet Firebase.
// Tu les trouves dans : Console Firebase > Paramètres du projet > Général
// > "Tes applications" > SDK Firebase (config).
// ===========================================================

// On importe les modules Firebase dont on a besoin (version modulaire v10)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js";

// mes propres identifiants Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDyGdUacgLaYUd7wx-kX4h_2fFzn_Xs0iI" ,
  authDomain: "vend-nous-ta-maladie.firebaseapp.com",
  projectId: "vend-nous-ta-maladie",
  storageBucket: "vend-nous-ta-maladie.firebasestorage.app",
  messagingSenderId: "577977511643",
  appId: "1:577977511643:web:96012c2808f027d30d66fe"
};

// Initialisation de Firebase
const app = initializeApp(firebaseConfig);

// On exporte auth et db pour les utiliser dans les autres fichiers JS
export const auth = getAuth(app);
// Base de données avec mémoire sur l'appareil : les données déjà vues restent
// disponibles sans connexion, et les écritures attendent le retour du réseau.
let baseDeDonnees;
try {
  baseDeDonnees = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
  });
} catch (e) {
  baseDeDonnees = getFirestore(app);
}
export const db = baseDeDonnees;
export const storage = getStorage(app);
