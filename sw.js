// ===========================================================
// sw.js — service worker : site rapide et utilisable avec peu (ou pas) de connexion
//  - pages, CSS et JS : réseau d'abord (3 s max), sinon copie sur le téléphone
//  - librairies Firebase et polices : copie locale d'abord, mise à jour en arrière-plan
//  - images Cloudinary : gardées sur le téléphone après le premier chargement
// Pour forcer une mise à jour chez tout le monde : change VERSION ci-dessous.
// ===========================================================
const VERSION = "vntm-v1";
const C_SITE = VERSION + "-site";
const C_EXTERNE = VERSION + "-externe";
const C_IMAGES = VERSION + "-images";

const A_GARDER = [
  "/", "/index.html", "/blog.html", "/article.html", "/produit.html", "/panier.html", "/profil.html",
  "/css/style.css", "/manifest.webmanifest", "/icone.svg",
  "/js/menu.js", "/js/outils.js", "/js/firebase-config.js", "/js/auth.js", "/js/produits.js",
  "/js/produit.js", "/js/panier.js", "/js/panier-utils.js", "/js/commande-rapide.js",
  "/js/blog.js", "/js/article.js", "/js/cloudinary.js", "/js/commandes-profil.js",
  "/js/ecrire-article.js", "/js/profil.js"
];

const HOTES_EXTERNES = ["www.gstatic.com", "fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(C_SITE)
      .then((cache) => Promise.allSettled(A_GARDER.map((u) => cache.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((noms) => Promise.all(noms.filter((n) => !n.startsWith(VERSION)).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

function avecDelai(promesse, ms) {
  return Promise.race([promesse, new Promise((_, rej) => setTimeout(() => rej(new Error("lent")), ms))]);
}

async function reseauPuisCopie(req) {
  const cache = await caches.open(C_SITE);
  try {
    const rep = await avecDelai(fetch(req), 3000);
    if (rep && rep.ok) cache.put(req, rep.clone());
    return rep;
  } catch {
    const copie = await cache.match(req, { ignoreSearch: true });
    if (copie) return copie;
    if (req.mode === "navigate") {
      const accueil = await cache.match("/index.html");
      if (accueil) return accueil;
    }
    return Response.error();
  }
}

async function copieEtMiseAJour(req, nomCache) {
  const cache = await caches.open(nomCache);
  const copie = await cache.match(req);
  const reseau = fetch(req).then((rep) => {
    if (rep && (rep.ok || rep.type === "opaque")) cache.put(req, rep.clone());
    return rep;
  }).catch(() => null);
  return copie || (await reseau) || Response.error();
}

async function imageDabordCopie(req) {
  const cache = await caches.open(C_IMAGES);
  const copie = await cache.match(req);
  if (copie) return copie;
  try {
    const rep = await fetch(req);
    if (rep && (rep.ok || rep.type === "opaque")) {
      cache.put(req, rep.clone());
      const cles = await cache.keys();
      if (cles.length > 80) await cache.delete(cles[0]); // on garde 80 images au maximum
    }
    return rep;
  } catch {
    return Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    event.respondWith(reseauPuisCopie(req));
  } else if (HOTES_EXTERNES.includes(url.hostname)) {
    event.respondWith(copieEtMiseAJour(req, C_EXTERNE));
  } else if (url.hostname === "res.cloudinary.com") {
    event.respondWith(imageDabordCopie(req));
  }
  // Firestore, connexion Firebase, etc. : on ne touche à rien
});
