// ===========================================================
// menu.js — barre du haut avec icônes (toutes les pages)
// Profil / Marketplace / Blog / Panier (en haut à droite) + hors-ligne
// ===========================================================
(function () {
  const nav = document.querySelector(".nav");
  const liens = nav && nav.querySelector(".nav-liens");
  if (!liens) return;

  const svg = (corps) =>
    `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${corps}</svg>`;

  const ICONES = {
    marketplace: svg('<path d="M3 9l1.5-5h15L21 9v1a3 3 0 01-6 0 3 3 0 01-6 0 3 3 0 01-6 0V9z"/><path d="M5 13v7h14v-7"/>'),
    blog: svg('<path d="M2 5h7a3 3 0 013 3v12a2 2 0 00-2-2H2z"/><path d="M22 5h-7a3 3 0 00-3 3v12a2 2 0 012-2h8z"/>'),
    profil: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>'),
    panier: svg('<path d="M3 4h2l2.4 11h10.2L20 7H6"/><circle cx="9" cy="20" r="1.5"/><circle cx="17" cy="20" r="1.5"/>')
  };

  const page = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  const actifs = {
    marketplace: page === "index.html" || page === "produit.html",
    blog: page === "blog.html" || page === "article.html",
    profil: page === "profil.html",
    panier: page === "panier.html"
  };

  const entrees = [
    ["marketplace", "index.html#marketplace", "Marketplace", ""],
    ["blog", "blog.html", "Blog", ""],
    ["profil", "profil.html", "Profil", "lien-profil"],
    ["panier", "panier.html", "Panier", "lien-panier"]   // panier = tout à droite
  ];

  liens.innerHTML = entrees.map(([cle, href, nom, id]) =>
    `<a href="${href}" ${id ? `id="${id}"` : ""} class="${actifs[cle] ? "actif" : ""}" aria-label="${nom}" title="${nom}">` +
    ICONES[cle] +
    (cle === "panier" ? '<span class="badge" hidden>0</span>' : "") +
    `</a>`
  ).join("");

  // Pastille avec le nombre d'articles du panier
  function majBadge() {
    let total = 0;
    try {
      const panier = JSON.parse(localStorage.getItem("panier_vend_nous_ta_maladie")) || [];
      total = panier.reduce((s, p) => s + (Number(p.quantite) || 0), 0);
    } catch {}
    const badge = liens.querySelector(".badge");
    if (!badge) return;
    badge.textContent = total > 99 ? "99+" : String(total);
    badge.hidden = total === 0;
  }
  majBadge();
  window.addEventListener("panier-maj", majBadge);
  window.addEventListener("storage", majBadge);

  // Mode hors-ligne + chargement rapide (service worker)
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch((e) => console.warn("SW non enregistré :", e));
    });
  }
})();
