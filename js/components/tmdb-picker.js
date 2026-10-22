// Recherche TMDB partagée (autocomplete) — écran Setup (liste perso) et constructeur de listes.
// Débounce 350ms avant d'interroger TMDB.
import { el } from "../lib/dom.js";
import { searchMulti } from "../lib/tmdb.js";
import { Poster } from "./ui.js";
import { icon } from "./icons.js";
import { fx } from "../lib/fx.js";

const timers = {};

export function tmdbSearch(key, query, onDone) {
  clearTimeout(timers[key]);
  if (!query || query.trim().length < 2) { onDone([], ""); return; }
  timers[key] = setTimeout(async () => {
    try {
      onDone(await searchMulti(query), "");
    } catch {
      onDone([], "Recherche indisponible — vérifie ta connexion.");
    }
  }, 350);
}

// Ligne de résultat : mini-affiche, titre, année · type, bouton + (ou ✓ si déjà ajouté, re-tap = retirer).
export function TmdbResultRow(m, inList, onAdd, onRemove) {
  return el("div", { class: "mm-row-item" }, [
    Poster(m),
    el("div", { class: "mm-row-text" }, [
      el("span", { class: "mm-row-title" }, [m.title]),
      el("span", { class: "mm-row-meta" }, [[m.year, m.media_type === "tv" ? "Série" : m.genre].filter(Boolean).join(" · ")]),
    ]),
    inList
      ? el("button", { type: "button", class: "mm-icon-btn ok", "aria-label": `Retirer ${m.title}`, onClick: () => onRemove && onRemove(m) }, [icon("check", 20, { stroke: 2.8 })])
      : el("button", { type: "button", class: "mm-icon-btn add", "aria-label": `Ajouter ${m.title}`, onClick: () => { fx.tap(); onAdd(m); } }, [icon("plus", 20, { stroke: 2.6 })]),
  ]);
}
