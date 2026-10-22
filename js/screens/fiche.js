// Fiche film/série — maquette "04 Fiche film" (feuille qui monte du bas).
// TMDB : note, réalisation/création, casting, synopsis, plateformes FR. Ajouts manuels : recherche TMDB
// par titre ; si introuvable, fiche générée par Claude (Edge Function claude-proxy).
import { el } from "../lib/dom.js";
import { state, setState } from "../state.js";
import { posterBg } from "../data/genre-style.js";
import { getDetails, searchMulti } from "../lib/tmdb.js";
import { ficheViaClaude } from "../lib/claude-proxy.js";
import { Sheet } from "../components/ui.js";
import { icon } from "../components/icons.js";
import { FilmLoader } from "../components/film-loader.js";
import { titleSize, titleFont } from "../lib/utils.js";
import { isSeen, toggleSeen } from "../lib/seen.js";
import { vote } from "./swipe.js";

// Cache mémoire pour ne pas relancer un fetch à chaque re-rendu (ex : polling en arrière-plan).
const cache = {};

function ensureLoaded(m) {
  if (cache[m.id]) return;
  cache[m.id] = { loading: true, data: null, err: "" };
  (async () => {
    try {
      let data;
      if (m.tmdb_id) data = await getDetails(m.media_type, m.tmdb_id);
      else {
        const matches = await searchMulti(m.title).catch(() => []);
        const best = matches.find((x) => !m.year || Math.abs((x.year || 0) - m.year) <= 1) || matches[0];
        data = best ? { ...(await getDetails(best.media_type, best.tmdb_id)), poster: best.poster } : await ficheViaClaude(m.title, m.year);
      }
      cache[m.id] = { loading: false, data, err: "" };
    } catch {
      cache[m.id] = { loading: false, data: null, err: "Fiche indisponible pour ce titre — vérifie l'orthographe ou ta connexion." };
    }
    setState({});
  })();
}

const h3 = (t) => el("h3", { class: "mm-label" }, [t]);

export function renderFiche(container) {
  const m = state.ficheFor;
  if (!m) return;
  ensureLoaded(m);
  const entry = cache[m.id] || { loading: true, data: null, err: "" };
  const d = entry.data || {};
  const tv = m.media_type === "tv" || d.isTv;
  const close = () => setState({ ficheFor: null });
  const title = String(m.title).toUpperCase();
  const canVote = state.ficheFromSwipe && state.screen === "swipe" && state.deck[state.idx] && state.deck[state.idx].id === m.id;

  const head = el("div", { class: "mm-fiche-head", style: { background: posterBg({ ...m, poster: d.poster || m.poster }) } }, [
    el("div", { class: "mm-fiche-shade" }),
    el("div", { class: "mm-handle light" }),
    el("button", { type: "button", class: "mm-fiche-close", "aria-label": "Fermer", onClick: close }, [icon("x", 18, { stroke: 2.4 })]),
    el("div", { class: "mm-fiche-title-wrap" }, [
      el("div", { class: "mm-row wrap" }, [
        el("span", { class: "mm-pill" }, [m.genre || "Perso"]),
        tv ? el("span", { class: "mm-pill gold-bg" }, [icon("tv", 14, { stroke: 2.2 }), "Série"]) : null,
      ]),
      el("h2", { class: "mm-fiche-title", style: { fontSize: titleFont(title, 48) } }, [title]),
    ]),
  ]);

  const body = el("div", { class: "mm-fiche-body" });
  if (entry.loading) body.appendChild(FilmLoader({ inline: true, text: "Chargement de la fiche…", hint: "Réalisation, casting, plateformes" }));
  else if (entry.err) {
    body.appendChild(el("p", { class: "mm-error" }, [entry.err]));
    if (m.pitch) body.appendChild(el("p", { class: "mm-synopsis" }, [m.pitch]));
  } else {
    const note = parseFloat(String(d.note || "").replace(",", "."));
    const stars = note ? Math.round(note) : 0;
    body.appendChild(el("div", { class: "mm-row-center left" }, [
      note ? el("span", { class: "mm-note-big" }, [String(d.note).replace(".", ","), el("small", {}, [" / 5"])]) : null,
      note ? el("span", { class: "mm-stars", role: "img", "aria-label": `${d.note} étoiles sur 5` }, ["★".repeat(stars), el("span", { class: "off" }, ["★".repeat(Math.max(0, 5 - stars))])]) : null,
      el("span", { class: "mm-note push-right" }, [[d.annee || m.year, d.duree || m.dur].filter(Boolean).join(" · ")]),
    ]));
    if (d.realisateur) body.appendChild(el("div", { class: "mm-info-card" }, [el("span", { class: "mm-note" }, [tv ? "Création" : "Réalisation"]), el("span", { class: "strong" }, [d.realisateur])]));
    if (d.casting?.length) body.appendChild(el("div", { class: "mm-field" }, [h3("Casting"), el("div", { class: "mm-chips" }, d.casting.slice(0, 6).map((a) => el("span", { class: "mm-cast" }, [a])))]));
    if (d.synopsis) body.appendChild(el("div", { class: "mm-field" }, [h3("Synopsis"), el("p", { class: "mm-synopsis" }, [d.synopsis])]));
    const plats = d.plateformes?.length ? d.plateformes : m.on || [];
    if (m.tmdb_id || plats.length) {
      body.appendChild(el("div", { class: "mm-field" }, [
        h3("Où le voir en France"),
        plats.length ? el("div", { class: "mm-chips" }, plats.map((p) => el("span", { class: "mm-plat" }, [p]))) : el("span", { class: "mm-note" }, ["Pas inclus dans les abonnements suivis (Netflix, Prime Video, Disney+, Canal+, Max, Apple TV+, Paramount+)."]),
      ]));
    }
  }

  const seen = isSeen(m);
  body.appendChild(el("button", {
    type: "button", class: "mm-btn dark md" + (seen ? " gold-line" : ""), "aria-pressed": String(seen),
    onClick: () => { toggleSeen(m); setState({}); },
  }, [icon("eye", 18), seen ? "Déjà vu — exclu des prochains tirages" : "Je l'ai déjà vu"]));

  if (canVote) {
    body.appendChild(el("div", { class: "mm-row" }, [
      el("button", { type: "button", class: "mm-btn danger strong", onClick: () => { setState({ ficheFor: null }); vote(false); } }, [icon("x", 18, { stroke: 2.5 }), "Passe"]),
      el("button", { type: "button", class: "mm-btn green", onClick: () => { setState({ ficheFor: null }); vote(true); } }, [icon("flame", 18, { stroke: 2.2 }), "Chaud"]),
    ]));
  }

  container.appendChild(Sheet({ label: `Fiche ${m.title}`, onClose: close, cls: "fiche", children: [head, body] }));
}
