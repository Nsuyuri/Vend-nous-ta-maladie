import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDyGdUacgLaYUd7wx-kX4h_2fFzn_Xs0iI",
  authDomain: "vend-nous-ta-maladie.firebaseapp.com",
  projectId: "vend-nous-ta-maladie",
  storageBucket: "vend-nous-ta-maladie.firebasestorage.app",
  messagingSenderId: "577977511643",
  appId: "1:577977511643:web:96012c2808f027d30d66fe"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
