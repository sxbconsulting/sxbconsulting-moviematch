// Fiche film/série — panneau coulissant depuis le bas.
// Films/séries du catalogue TMDB : note/réalisateur/casting/synopsis via TMDB.
// Ajouts manuels (sans tmdb_id) : recherche TMDB par titre d'abord ; si introuvable,
// fiche générée par Claude (Edge Function claude-proxy).
import { el } from "../lib/dom.js";
import { state, setState } from "../state.js";
import { genreStyleOf } from "../data/genre-style.js";
import { getDetails, searchMulti } from "../lib/tmdb.js";
import { ficheViaClaude } from "../lib/claude-proxy.js";

// Cache mémoire pour ne pas relancer un fetch à chaque re-rendu (ex : polling en arrière-plan).
const cache = {};

function ensureLoaded(m) {
  if (cache[m.id]) return;
  cache[m.id] = { loading: true, data: null, err: "" };
  (async () => {
    try {
      if (m.tmdb_id) {
        const data = await getDetails(m.media_type, m.tmdb_id);
        cache[m.id] = { loading: false, data, err: "" };
      } else {
        const matches = await searchMulti(m.title).catch(() => []);
        const best = matches.find((x) => !m.year || Math.abs((x.year || 0) - m.year) <= 1) || matches[0];
        const data = best
          ? { ...(await getDetails(best.media_type, best.tmdb_id)), poster: best.poster }
          : await ficheViaClaude(m.title, m.year);
        cache[m.id] = { loading: false, data, err: "" };
      }
    } catch {
      cache[m.id] = { loading: false, data: null, err: "Fiche indisponible pour ce titre — vérifie l'orthographe ou ta connexion." };
    }
    setState({});
  })();
}

export function renderFiche(container) {
  const m = state.ficheFor;
  if (!m) return;
  ensureLoaded(m);
  const entry = cache[m.id] || { loading: true, data: null, err: "" };
  const gs = genreStyleOf(m.genre);
  const close = () => setState({ ficheFor: null });

  const poster = entry.data?.poster || m.poster;
  const annee = entry.data?.annee || m.year || "";
  const duree = entry.data?.duree || m.dur || "";

  const head = el("div", { class: "mm-fiche-head", style: { background: poster ? `linear-gradient(to bottom, #00000040, #14162aee), url(${poster}) center/cover, ${gs.grad}` : gs.grad } }, [
    el("button", { class: "mm-fiche-close", onClick: close }, ["✕"]),
    el("div", { style: { fontFamily: "var(--font-display)", fontSize: "34px", lineHeight: "0.95", letterSpacing: "1px", paddingRight: "34px" } }, [m.title]),
    el("div", { style: { fontSize: "13px", color: "#ffffffcc", marginTop: "6px" } }, [
      `${annee}${duree ? " · " + duree : ""} · ${m.genre}${m.media_type === "tv" ? " · 📺 Série" : ""}`,
    ]),
  ]);

  const body = el("div", { class: "mm-fiche-body" });

  if (entry.loading) {
    body.appendChild(el("p", { class: "mm-dim", style: { fontSize: "14px" } }, ["Chargement de la fiche…"]));
  } else if (entry.err) {
    body.appendChild(el("p", { class: "mm-error", style: { fontSize: "14px" } }, [entry.err]));
    body.appendChild(el("p", { style: { fontSize: "14px", lineHeight: "1.55", color: "#dddaea", marginTop: "10px" } }, [m.pitch || ""]));
  } else {
    const data = entry.data;
    if (data.note) {
      body.appendChild(el("div", { class: "mm-fiche-note" }, [
        el("span", { style: { color: "var(--marquee)" } }, ["★"]),
        el("span", { style: { fontFamily: "var(--font-display)", fontSize: "18px", color: "var(--marquee)", letterSpacing: "1px" } }, [data.note]),
        el("span", { class: "mm-dim", style: { fontSize: "11px" } }, ["/ 5"]),
      ]));
    }
    if (data.realisateur) {
      body.appendChild(el("div", { style: { marginBottom: "10px" } }, [
        el("div", { style: { fontSize: "11px", color: "var(--dim)", letterSpacing: "1px", fontWeight: "700" } }, [m.media_type === "tv" ? "CRÉATION" : "RÉALISATION"]),
        el("div", { style: { fontSize: "15px" } }, [data.realisateur]),
      ]));
    }
    if (data.casting?.length) {
      const chips = el("div", { style: { display: "flex", flexWrap: "wrap", gap: "6px" } });
      data.casting.forEach((a) => chips.appendChild(el("span", { style: { background: "#191b2a", border: "1px solid var(--line)", borderRadius: "99px", padding: "5px 11px", fontSize: "13px" } }, [a])));
      body.appendChild(el("div", { style: { marginBottom: "10px" } }, [
        el("div", { style: { fontSize: "11px", color: "var(--dim)", letterSpacing: "1px", fontWeight: "700", marginBottom: "6px" } }, ["CASTING"]),
        chips,
      ]));
    }
    if (data.synopsis) {
      body.appendChild(el("div", {}, [
        el("div", { style: { fontSize: "11px", color: "var(--dim)", letterSpacing: "1px", fontWeight: "700", marginBottom: "4px" } }, ["SYNOPSIS"]),
        el("p", { style: { fontSize: "14px", lineHeight: "1.55", color: "#dddaea", margin: 0 } }, [data.synopsis]),
      ]));
    }
  }

  const sheet = el("div", { class: "mm-fiche-sheet", onClick: (e) => e.stopPropagation() }, [head, body]);
  const overlay = el("div", { class: "mm-fiche-overlay", onClick: close }, [sheet]);
  container.appendChild(overlay);
}
