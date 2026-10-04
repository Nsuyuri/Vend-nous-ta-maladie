// ===========================================================
// cloudinary.js — envoi d'images vers Cloudinary (preset non signé)
// Seuls le Cloud name et le nom du preset sont ici : jamais l'API Secret.
// ===========================================================

const CLOUD_NAME = "dtv0qyanr";
const UPLOAD_PRESET = "vend-nous-ta-maladie"; // doit être identique au preset "Unsigned" créé sur Cloudinary

export async function envoyerImage(fichier, dossier = "produits") {
  const donnees = new FormData();
  donnees.append("file", fichier);
  donnees.append("upload_preset", UPLOAD_PRESET);
  donnees.append("folder", dossier);

  const reponse = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: "POST", body: donnees }
  );
  if (!reponse.ok) {
    // Cloudinary explique la cause dans sa réponse (ex : preset introuvable)
    const erreur = await reponse.json().catch(() => ({}));
    throw new Error("Cloudinary : " + (erreur.error?.message || "statut " + reponse.status));
  }

  const resultat = await reponse.json();
  return resultat.secure_url; // lien https de l'image
}
