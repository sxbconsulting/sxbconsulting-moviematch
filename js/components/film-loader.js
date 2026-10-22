// Loader "pellicule" — bande sombre, perforations jaunes, images qui défilent (maquette C4).
// Immobile si l'utilisateur préfère moins d'animations (voir CSS prefers-reduced-motion).
import { el } from "../lib/dom.js";
import { GENRE_STYLE } from "../data/genre-style.js";

function strip(small) {
  const g = Object.values(GENRE_STYLE).slice(0, 6).map((x) => x.grad);
  const frames = [...g, ...g, ...g].map((bg) => el("div", { class: "mm-frame", style: { background: bg } }));
  return el("div", { class: "mm-strip" + (small ? " small" : ""), "aria-hidden": "true" }, [
    el("div", { class: "mm-perf" }),
    el("div", { class: "mm-strip-win" }, [el("div", { class: "mm-reel" }, frames)]),
    el("div", { class: "mm-perf" }),
  ]);
}

export function FilmLoader({ inline = false, text = "Chargement de la séance…", hint = "" } = {}) {
  if (inline) {
    return el("div", { class: "mm-loader-inline", role: "status" }, [
      strip(true),
      el("div", { class: "mm-loader-txt" }, [el("span", {}, [text]), hint ? el("small", {}, [hint]) : null]),
    ]);
  }
  return el("div", { class: "mm-loader-full", role: "status" }, [
    strip(false),
    el("div", { class: "mm-loader-big" }, [(text || "Chargement…").toUpperCase()]),
    hint ? el("div", { class: "mm-loader-hint" }, [hint]) : null,
  ]);
}
