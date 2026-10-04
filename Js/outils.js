// ===========================================================
// outils.js — petits outils partagés (rapidité + confort)
// ===========================================================

// Réduit le poids des images Cloudinary (format et qualité automatiques, largeur adaptée).
// Une image de 2 Mo peut passer à ~30 Ko : essentiel avec une connexion lente.
export function optimiserImage(url, largeur = 400) {
  const u = String(url || "");
  if (!u.includes("res.cloudinary.com") || !u.includes("/upload/") || u.includes("/upload/f_auto")) return u;
  return u.replace("/upload/", `/upload/f_auto,q_auto,w_${largeur}/`);
}

// Petit message qui apparaît en bas de l'écran puis disparaît
export function afficherToast(texte) {
  let toast = document.getElementById("toast-vntm");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast-vntm";
    toast.className = "toast";
    toast.setAttribute("role", "status");
    document.body.appendChild(toast);
  }
  toast.textContent = texte;
  toast.classList.add("visible");
  clearTimeout(toast._minuteur);
  toast._minuteur = setTimeout(() => toast.classList.remove("visible"), 2200);
}
