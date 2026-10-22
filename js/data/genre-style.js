// Dégradés de secours par genre (cartes sans affiche, mini-affiches) — palette de la maquette Claude Design.
export const GENRE_STYLE = {
  "Sci-Fi":    { grad: "linear-gradient(160deg,#4b36b0,#1b1446)", chip: "#a99bff" },
  "Thriller":  { grad: "linear-gradient(160deg,#8f1a28,#2a070c)", chip: "#ff8a8a" },
  "Drame":     { grad: "linear-gradient(160deg,#16818c,#082e33)", chip: "#5fd3dc" },
  "Action":    { grad: "linear-gradient(160deg,#e0711f,#4a1d06)", chip: "#ffa463" },
  "Comédie":   { grad: "linear-gradient(160deg,#e9b423,#6b4a06)", chip: "#ffd56e" },
  "Romance":   { grad: "linear-gradient(160deg,#c22a87,#3d0a2a)", chip: "#ff8fcf" },
  "Horreur":   { grad: "linear-gradient(160deg,#3a3a46,#0e0e14)", chip: "#b9b9c6" },
  "Western":   { grad: "linear-gradient(160deg,#9a6532,#2e1b0a)", chip: "#e0b07a" },
  "Animation": { grad: "linear-gradient(160deg,#e2649a,#5a1a3a)", chip: "#ffa3c6" },
  "Perso":     { grad: "linear-gradient(160deg,#3b2a8f,#0d0a24)", chip: "#b3a7ff" },
};

export const GENRES = Object.keys(GENRE_STYLE).filter((g) => g !== "Perso");

export function genreStyleOf(genre) {
  return GENRE_STYLE[genre] || GENRE_STYLE["Perso"];
}

// Fond d'une affiche : image TMDB par-dessus le dégradé du genre (visible pendant le chargement).
export function posterBg(m, overlay = "") {
  const grad = genreStyleOf(m && m.genre).grad;
  if (m && m.poster) return `${overlay ? overlay + ", " : ""}url(${m.poster}) center/cover, ${grad}`;
  return grad;
}
