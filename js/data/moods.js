// Humeurs → genres (voir js/data/genre-style.js pour les 9 catégories).
// Étape 1 mappait des humeurs vers une liste fixe de films ; étape 2 interroge TMDB
// par genre à la demande (moodPool est donc maintenant asynchrone).
import { discoverByGenres } from "../lib/tmdb.js";
import { pickRandom } from "../lib/utils.js";

export const MOODS = [
  { key: "rire", emoji: "😂", label: "Envie de rire", genres: ["Comédie"] },
  { key: "pleurer", emoji: "😢", label: "Besoin d'émotion", genres: ["Drame", "Romance"] },
  { key: "aventure", emoji: "🗺️", label: "Désir d'aventure", genres: ["Action", "Sci-Fi"] },
  { key: "frissons", emoji: "😱", label: "Frissons", genres: ["Horreur", "Thriller"] },
  { key: "amour", emoji: "❤️", label: "Romance", genres: ["Romance"] },
  { key: "reflexion", emoji: "🧠", label: "Envie de réfléchir", genres: ["Sci-Fi", "Thriller"] },
  { key: "adrenaline", emoji: "🔥", label: "Adrénaline", genres: ["Action"] },
  { key: "cosy", emoji: "🌙", label: "Soirée cosy", genres: ["Animation", "Comédie"] },
];

export async function moodPool(mood) {
  const items = await discoverByGenres(mood.genres, "both");
  return pickRandom(items, Math.min(20, items.length));
}
