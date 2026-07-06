// Dégradés de secours par genre — utilisés quand un film n'a pas d'affiche (TMDB indisponible ou ajout manuel).
// Repris à l'identique du prototype (objet GENRE_STYLE).
export const GENRE_STYLE = {
  "Sci-Fi":    { grad: "linear-gradient(160deg,#1b2a6b 0%,#4338ca 55%,#7c3aed 100%)", chip: "#818cf8" },
  "Thriller":  { grad: "linear-gradient(160deg,#3b0d0d 0%,#7f1d1d 55%,#b91c1c 100%)", chip: "#f87171" },
  "Drame":     { grad: "linear-gradient(160deg,#0c3b3b 0%,#0f766e 55%,#0d9488 100%)", chip: "#2dd4bf" },
  "Action":    { grad: "linear-gradient(160deg,#431407 0%,#9a3412 55%,#ea580c 100%)", chip: "#fb923c" },
  "Comédie":   { grad: "linear-gradient(160deg,#713f12 0%,#ca8a04 55%,#eab308 100%)", chip: "#fde047" },
  "Romance":   { grad: "linear-gradient(160deg,#4a044e 0%,#a21caf 55%,#db2777 100%)", chip: "#f0abfc" },
  "Horreur":   { grad: "linear-gradient(160deg,#111 0%,#27272a 55%,#52525b 100%)", chip: "#a1a1aa" },
  "Western":   { grad: "linear-gradient(160deg,#451a03 0%,#92400e 55%,#b45309 100%)", chip: "#fbbf24" },
  "Animation": { grad: "linear-gradient(160deg,#500724 0%,#be185d 55%,#f472b6 100%)", chip: "#f9a8d4" },
  "Perso":     { grad: "linear-gradient(160deg,#1e1b4b 0%,#312e81 55%,#4f46e5 100%)", chip: "#a5b4fc" },
};

export const GENRES = Object.keys(GENRE_STYLE).filter((g) => g !== "Perso");

export function genreStyleOf(genre) {
  return GENRE_STYLE[genre] || GENRE_STYLE["Perso"];
}
