// Recherche TMDB partagée (autocomplete) — utilisée par l'écran Setup (liste perso)
// et le constructeur de listes (onglet Catalogue). Débounce 350ms avant d'interroger TMDB.
import { el } from "../lib/dom.js";
import { searchMulti } from "../lib/tmdb.js";
import { genreStyleOf } from "../data/genre-style.js";

const timers = {};

export function tmdbSearch(key, query, onDone) {
  clearTimeout(timers[key]);
  if (!query || query.trim().length < 2) { onDone([], ""); return; }
  timers[key] = setTimeout(async () => {
    try {
      const results = await searchMulti(query);
      onDone(results, "");
    } catch {
      onDone([], "Recherche indisponible — vérifie ta connexion.");
    }
  }, 350);
}

export function TmdbResultRow(m, inList, onAdd) {
  const gs = genreStyleOf(m.genre);
  return el("div", {
    style: { display: "flex", alignItems: "center", gap: "10px", padding: "7px 10px", background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "10px", marginBottom: "6px" },
  }, [
    el("div", { style: { width: "30px", height: "42px", borderRadius: "6px", flexShrink: "0", background: m.poster ? `url(${m.poster}) center/cover` : gs.grad } }),
    el("span", { style: { flex: "1", fontSize: "14px", minWidth: "0" } }, [
      m.title,
      el("span", { class: "mm-dim", style: { fontSize: "12px" } }, [
        `${m.year ? " · " + m.year : ""}${m.media_type === "tv" ? " · 📺" : ""}`,
      ]),
    ]),
    el("button", {
      class: "mm-btn mm-btn-ghost", style: { padding: "4px 12px", color: inList ? "var(--match)" : "var(--text)" },
      onClick: () => !inList && onAdd(m),
    }, [inList ? "✓" : "+"]),
  ]);
}
