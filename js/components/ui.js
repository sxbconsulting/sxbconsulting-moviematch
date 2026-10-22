// Briques d'interface partagées : barre du haut, mini-affiche, feuille (bottom sheet), tampons.
import { el } from "../lib/dom.js";
import { icon } from "./icons.js";
import { posterBg } from "../data/genre-style.js";

export function TopBar({ onBack, backLabel = "Retour", right = null, dark = false } = {}) {
  return el("div", { class: "mm-topbar" + (dark ? " dark" : "") }, [
    onBack ? el("button", { type: "button", class: "mm-back", onClick: onBack }, [icon("back", 22), backLabel]) : el("span"),
    right,
  ]);
}

export function Poster(m, { w = 40, h = 60, r = 8, cls = "" } = {}) {
  return el("div", {
    class: "mm-poster " + cls, "aria-hidden": "true",
    style: { width: w + "px", height: h + "px", borderRadius: r + "px", background: posterBg(m) },
  });
}

// Feuille qui monte du bas. onClose = clic sur le fond, bouton fermer, ou touche Échap.
export function Sheet({ label, onClose, children, cls = "" }) {
  const sheet = el("div", { class: "mm-sheet " + cls, role: "dialog", "aria-modal": "true", "aria-label": label }, children);
  return el("div", { class: "mm-sheet-wrap" }, [
    el("button", { type: "button", class: "mm-sheet-backdrop", "aria-label": "Fermer", onClick: onClose }),
    sheet,
  ]);
}

export function Empty(text, action = null) {
  return el("div", { class: "mm-empty" }, [el("span", {}, [text]), action]);
}

export function Pill(text, extra = "") {
  return el("span", { class: "mm-pill " + extra }, [text]);
}
