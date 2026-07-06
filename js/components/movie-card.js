// Carte film/série — affiche TMDB si dispo (étape 2), sinon dégradé par genre.
import { el } from "../lib/dom.js";
import { genreStyleOf } from "../data/genre-style.js";

export function MovieCard(m, { compact = false, badge = null, badgeColor = null, extraStyle = {} } = {}) {
  const gs = genreStyleOf(m.genre);
  const style = {
    // Le dégradé du genre reste en dernière couche : il s'affiche immédiatement pendant
    // le chargement de l'affiche (évite tout effet de transparence/superposition avec la carte suivante).
    background: m.poster
      ? `linear-gradient(to bottom, #00000010 35%, #000000dd 100%), url(${m.poster}) center/cover, ${gs.grad}`
      : gs.grad,
    ...extraStyle,
  };

  const badges = [el("span", { class: "mm-card-badge", style: { color: gs.chip } }, [m.genre])];
  if (m.dur) badges.push(el("span", { class: "mm-card-badge" }, [m.dur]));
  if (m.media_type === "tv") badges.push(el("span", { class: "mm-card-badge" }, ["📺 Série"]));

  const children = [el("div", { class: "mm-card-badges" }, badges)];

  if (badge) {
    children.push(
      el("div", { class: "mm-card-flag", style: { borderColor: badgeColor, color: badgeColor } }, [badge])
    );
  }

  children.push(el("div", { class: "mm-card-title" }, [m.title]));
  if (m.year) children.push(el("div", { class: "mm-card-year" }, [String(m.year)]));
  if (m.pitch && !compact) children.push(el("p", { class: "mm-card-pitch" }, [m.pitch]));

  return el("div", { class: "mm-card" + (compact ? " compact" : ""), style }, children);
}
