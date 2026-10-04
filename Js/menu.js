// ===========================================================
// menu.js — menu hamburger (téléphone) + icônes, pour toutes les pages
// ===========================================================
(function () {
  const nav = document.querySelector(".nav");
  const liens = nav && nav.querySelector(".nav-liens");
  if (!liens) return;

  // Lien « Accueil » (visible seulement dans le menu du téléphone)
  const accueil = document.createElement("a");
  accueil.href = "index.html";
  accueil.className = "lien-accueil-menu";
  accueil.textContent = "Accueil";
  liens.insertBefore(accueil, liens.firstChild);

  // Bouton hamburger
  const bouton = document.createElement("button");
  bouton.type = "button";
  bouton.className = "menu-bouton";
  bouton.setAttribute("aria-label", "Ouvrir le menu");
  bouton.setAttribute("aria-expanded", "false");
  bouton.textContent = "☰";
  nav.insertBefore(bouton, liens);

  function fermer() {
    liens.classList.remove("ouvert");
    bouton.textContent = "☰";
    bouton.setAttribute("aria-expanded", "false");
  }

  bouton.addEventListener("click", () => {
    const ouvert = liens.classList.toggle("ouvert");
    bouton.textContent = ouvert ? "✕" : "☰";
    bouton.setAttribute("aria-expanded", String(ouvert));
  });

  liens.addEventListener("click", (e) => { if (e.target.closest("a")) fermer(); });
  document.addEventListener("click", (e) => { if (!nav.contains(e.target)) fermer(); });
})();
