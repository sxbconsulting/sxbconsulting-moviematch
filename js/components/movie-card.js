// Carte film/série — affiche TMDB si dispo, sinon dégradé par genre (maquette Claude Design).
import { el } from "../lib/dom.js";
import { posterBg } from "../data/genre-style.js";
import { icon } from "./icons.js";
import { titleSize, titleFont, metaLine } from "../lib/utils.js";

const STAMPS = { hot: ["CHAUD", "hot"], pass: ["PASSE", "pass"], seen: ["DÉJÀ VU", "seen"] };

export function MovieCard(m, { compact = false, stamp = null, stampOpacity = 0.95, selected = false, bare = false } = {}) {
  const card = el("div", {
    class: "mm-card" + (compact ? " compact" : "") + (selected ? " selected" : ""),
    style: { background: posterBg(m) },
  });
  card.appendChild(el("div", { class: "mm-card-ring a", "aria-hidden": "true" }));
  card.appendChild(el("div", { class: "mm-card-ring b", "aria-hidden": "true" }));
  card.appendChild(el("div", { class: "mm-card-shade" }));

  const pills = [el("span", { class: "mm-pill" }, [m.genre || "Perso"])];
  if (m.media_type === "tv") pills.push(el("span", { class: "mm-pill" }, [icon("tv", 13), "Série"]));
  (m.on || []).slice(0, 2).forEach((p) => pills.push(el("span", { class: "mm-pill gold" }, [p])));
  card.appendChild(el("div", { class: "mm-card-pills" }, pills));

  if (selected) card.appendChild(el("span", { class: "mm-card-check" }, [icon("check", 20, { stroke: 3 })]));

  const st = STAMPS[stamp];
  if (st) card.appendChild(el("div", { class: "mm-stamp " + st[1], style: { opacity: String(stampOpacity) } }, [st[0]]));

  if (!bare) {
    const title = String(m.title || "").toUpperCase();
    card.appendChild(el("div", { class: "mm-card-info" }, [
      el("h2", { class: "mm-card-title", style: { fontSize: titleFont(title, compact ? 38 : 50) } }, [title]),
      metaLine(m) ? el("div", { class: "mm-card-meta" }, [metaLine(m)]) : null,
      !compact && m.pitch ? el("p", { class: "mm-card-pitch" }, [m.pitch]) : null,
    ]));
  }
  return card;
}
