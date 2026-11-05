// ===========================================================
// limites-images.js — taille maximale des photos + calcul de capacité Cloudinary
//
// Plan gratuit Cloudinary : 25 crédits/mois. 1 crédit = 1 Go de stockage
// OU 1 Go de bande passante OU 1000 transformations (le tout partagé).
// On réserve donc : 10 Go stockage + 10 Go bande passante + 5000 transformations = 25 crédits.
//
// Règle : on vise 5 Mo par photo. Si, en comptant chaque photo existante
// au pire cas (5 Mo), le stockage dépasse 80 % du budget, on passe à 4 Mo.
// Si même à 4 Mo il n'y a plus de place, on bloque les envois.
// ===========================================================

import { sb } from "./supabase-config.js";

const Mo = 1024 * 1024;
const BUDGET_STOCKAGE = 10 * 1024 * Mo; // 10 Go réservés au stockage
export const TAILLE_NORMALE = 5 * Mo;
export const TAILLE_REDUITE = 4 * Mo;
const SEUIL_BASCULE = 0.8; // au-delà de 80 % du budget → 4 Mo

// Compte les photos déjà envoyées (produits + articles + photos de profil)
async function compterPhotos() {
  const demandes = [
    sb.from("produits").select("id", { count: "exact", head: true }).not("image_url", "is", null),
    sb.from("articles").select("id", { count: "exact", head: true }).not("image_url", "is", null),
    sb.from("utilisateurs").select("id", { count: "exact", head: true }).not("photo_url", "is", null)
  ];
  const reponses = await Promise.all(demandes);
  let total = 0;
  for (const r of reponses) {
    if (r.error) throw r.error;
    total += r.count || 0;
  }
  return total;
}

// Rend { maxOctets, maxMo, photos, utilise, restant, nbPhotosRestantes, bloque }
export async function calculerLimite() {
  let photos;
  try {
    photos = await compterPhotos();
  } catch (err) {
    console.warn("Comptage des photos impossible, limite prudente de 4 Mo :", err);
    return { maxOctets: TAILLE_REDUITE, maxMo: 4, photos: null, bloque: false };
  }

  const utilise = photos * TAILLE_NORMALE; // pire cas : chaque photo existante pèse 5 Mo
  const restant = Math.max(0, BUDGET_STOCKAGE - utilise);

  let maxOctets = TAILLE_NORMALE;
  if (utilise > BUDGET_STOCKAGE * SEUIL_BASCULE) maxOctets = TAILLE_REDUITE;

  const bloque = restant < maxOctets;
  return {
    maxOctets,
    maxMo: maxOctets / Mo,
    photos,
    utilise,
    restant,
    nbPhotosRestantes: Math.floor(restant / maxOctets),
    bloque
  };
}

// Vérifie un fichier. Rend null si OK, sinon le message d'erreur à afficher.
export async function verifierPhoto(fichier) {
  if (!fichier) return null;
  if (!fichier.type.startsWith("image/")) return "Ce fichier n'est pas une image.";
  const limite = await calculerLimite();
  if (limite.bloque) {
    return "L'espace photo du site est presque plein. Réessaie plus tard ou contacte l'équipe.";
  }
  if (fichier.size > limite.maxOctets) {
    return `La photo dépasse ${limite.maxMo} Mo. Choisis une image plus légère.`;
  }
  return null;
}

// Met à jour un texte d'aide (ex : « JPG ou PNG, moins de 5 Mo »)
export async function afficherLimite(element) {
  if (!element) return;
  const limite = await calculerLimite();
  element.textContent = limite.bloque
    ? "Envoi de photos indisponible pour le moment."
    : `JPG ou PNG, moins de ${limite.maxMo} Mo`;
}
