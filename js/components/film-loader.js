// Loader "pellicule de film" — bande à perforations qui défile.
// Désactivé automatiquement si l'utilisateur préfère moins d'animations (voir CSS prefers-reduced-motion).
import { el } from "../lib/dom.js";

export function FilmLoader({ inline = false, text = "Chargement de la séance…" } = {}) {
  const strip = el("div", { class: "mm-loader-strip" + (inline ? " inline" : "") }, [
    el("div", { class: "mm-loader-reel" }, [
      el("div", { class: "mm-roll holes" }),
      el("div", { class: "mm-roll frames" }),
      el("div", { class: "mm-roll holes" }),
    ]),
    el("div", { class: "mm-loader-text" }, [text]),
  ]);
  if (inline) return strip;
  return el("div", { class: "mm-loader-overlay" }, [strip]);
}
