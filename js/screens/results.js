// Résultats live — trie les matchs (100% des joueurs ont liké) en premier.
import { el } from "../lib/dom.js";
import { state, setState } from "../state.js";
import { Ticket } from "../components/ticket.js";
import { FilmLoader } from "../components/film-loader.js";
import { genreStyleOf } from "../data/genre-style.js";

export function renderResults(container) {
  const { deck, players, code, winner } = state;
  const nDone = players.filter((p) => p.done).length;

  const rows = deck.map((m) => {
    const voters = players.filter((p) => m.id in (p.votes || {}));
    const likes = voters.filter((p) => p.votes[m.id]);
    const isMatch = players.length >= 2 && voters.length === players.length && likes.length === players.length;
    return { m, likes, isMatch };
  }).filter((r) => r.likes.length > 0)
    .sort((a, b) => (b.isMatch - a.isMatch) || (b.likes.length - a.likes.length));

  const matches = rows.filter((r) => r.isMatch);

  const wrap = el("div", { style: { marginTop: "8px" } });
  wrap.appendChild(Ticket(code));

  wrap.appendChild(el("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", margin: "20px 0 12px" } }, [
    el("div", { class: "mm-title", style: { margin: 0 } }, ["RÉSULTATS ", el("span", { class: "mm-dim", style: { fontSize: "14px", fontFamily: "var(--font-body)" } }, ["· live"])]),
    el("span", { class: "mm-dim", style: { fontSize: "12px" } }, [`${nDone}/${players.length} ont fini`]),
  ]));

  if (players.length < 2) {
    wrap.appendChild(el("div", { class: "mm-panel" }, [
      FilmLoader({ inline: true, text: "" }),
      el("p", { class: "mm-dim", style: { fontSize: "14px", margin: "10px 0 0" } }, [
        "En attente des potes… Partage le code ", el("b", { style: { color: "var(--marquee)" } }, [code]), " — ça se met à jour tout seul.",
      ]),
    ]));
  }

  if (winner) {
    wrap.appendChild(el("div", {
      style: { display: "flex", alignItems: "center", gap: "12px", padding: "12px 14px", margin: "14px 0 4px", borderRadius: "14px", background: "#ffc53d1a", border: "1px solid #ffc53d66" },
    }, [
      el("span", { style: { fontSize: "24px" } }, ["🏆"]),
      el("div", {}, [
        el("div", { style: { fontSize: "11px", color: "var(--marquee)", letterSpacing: "1px", fontWeight: "700" } }, ["FILM DE LA SOIRÉE"]),
        el("div", { style: { fontFamily: "var(--font-display)", fontSize: "24px", letterSpacing: "1px" } }, [winner.title]),
      ]),
    ]));
  }

  if (matches.length > 0) {
    wrap.appendChild(el("div", { style: { marginBottom: "8px", fontSize: "13px", color: "var(--match)" } }, [
      `🎉 ${matches.length} match${matches.length > 1 ? "s" : ""} — tout le monde est chaud !`,
    ]));
  }

  rows.forEach(({ m, likes, isMatch }) => {
    const gs = genreStyleOf(m.genre);
    wrap.appendChild(el("div", {
      class: "mm-result-row" + (isMatch ? " match" : ""),
      onClick: () => setState({ ficheFor: m }),
    }, [
      el("div", { class: "mm-result-thumb", style: { background: m.poster ? `url(${m.poster}) center/cover` : gs.grad } }),
      el("div", { style: { flex: "1", minWidth: "0" } }, [
        el("div", { style: { fontWeight: "700", fontSize: "15px" } }, [m.title + (isMatch ? " ✨" : "")]),
        el("div", { style: { fontSize: "12px", color: "var(--dim)" } }, [likes.map((p) => p.name).join(", ")]),
      ]),
      el("div", { class: "mm-result-score", style: { color: isMatch ? "var(--match)" : "var(--text)" } }, [
        String(likes.length), el("span", { class: "mm-dim", style: { fontSize: "14px" } }, [`/${players.length}`]),
      ]),
    ]));
  });

  if (rows.length === 0 && players.length >= 2) {
    wrap.appendChild(el("p", { class: "mm-dim", style: { fontSize: "14px" } }, ["Personne n'a encore liké de film. Ça swipe ! 👆"]));
  }

  if (rows.length >= 2) {
    const pool = (matches.length >= 2 ? matches : rows).slice(0, 8).map((r) => r.m);
    wrap.appendChild(el("button", {
      class: "mm-btn mm-btn-primary outline", style: { marginTop: "14px" },
      onClick: () => setState({ vsPool: pool, winner: null, vsBack: "results", screen: "versus" }),
    }, [`⚔️ Départager en VS (${Math.min((matches.length >= 2 ? matches : rows).length, 8)} films)`]));
  }

  const hasUnvoted = deck.some((m) => !(m.id in state.votes));
  if (hasUnvoted) {
    wrap.appendChild(el("button", {
      class: "mm-btn mm-btn-primary", style: { marginTop: "16px" },
      onClick: () => {
        const first = deck.findIndex((m) => !(m.id in state.votes));
        if (first !== -1) setState({ idx: first, screen: "swipe" });
      },
    }, ["Continuer à swiper"]));
  }

  container.appendChild(wrap);
}
