// Tournoi VS — duels à 2, tap = gagnant, byes si nombre impair.
import { el } from "../lib/dom.js";
import { state, setState } from "../state.js";
import { MovieCard } from "../components/movie-card.js";
import { setWinner as saveWinner } from "../lib/backend.js";

// État transitoire du tournoi (reconstruit à chaque entrée sur l'écran).
let round = [];
let next = [];
let i = 0;
let champ = null;
let picked = null;
let seededFor = null;

function resetIfNeeded() {
  if (seededFor !== state.vsPool) {
    round = state.vsPool;
    next = [];
    i = 0;
    champ = null;
    picked = null;
    seededFor = state.vsPool;
  }
}

async function finish(m) {
  champ = m;
  setState({ winner: m });
  if (!state.local && state.code) await saveWinner(state.code, m);
}

function finishRound(n) {
  if (n.length === 1) { finish(n[0]); }
  else { round = n; next = []; i = 0; }
}

function pick(m) {
  if (picked) return;
  picked = m.id;
  setState({}); // force un re-rendu pour afficher le flash visuel
  setTimeout(() => {
    picked = null;
    const n = [...next, m];
    const ni = i + 2;
    if (ni + 1 < round.length) { next = n; i = ni; }
    else if (ni < round.length) { finishRound([...n, round[ni]]); }
    else { finishRound(n); }
    setState({});
  }, 350);
}

export function renderVersus(container) {
  resetIfNeeded();
  const wrap = el("div", { style: { marginTop: "8px" } });

  if (champ) {
    wrap.appendChild(el("div", { style: { textAlign: "center", margin: "10px 0 14px" } }, [
      el("div", { style: { fontSize: "40px" } }, ["🏆"]),
      el("div", { style: { fontFamily: "var(--font-display)", fontSize: "30px", letterSpacing: "2px", color: "var(--marquee)" } }, ["FILM DE LA SOIRÉE"]),
    ]));
    const stage = el("div", { style: { position: "relative", height: "420px" } }, [MovieCard(champ)]);
    wrap.appendChild(stage);
    wrap.appendChild(el("button", {
      class: "mm-btn mm-btn-primary", style: { marginTop: "18px" },
      onClick: () => setState({ screen: state.vsBack }),
    }, ["Retour"]));
    container.appendChild(wrap);
    return;
  }

  const a = round[i], b = round[i + 1];
  if (!a || !b) { container.appendChild(wrap); return; }

  const duelNum = Math.floor(i / 2) + 1;
  const duelsInRound = Math.floor(round.length / 2);
  const roundLabel = round.length === 2 ? "🏁 FINALE" : `${round.length} films en lice`;

  wrap.appendChild(el("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" } }, [
    el("button", { class: "mm-btn mm-btn-ghost", onClick: () => setState({ screen: state.vsBack }) }, ["← Résultats"]),
    el("span", { class: "mm-dim", style: { fontSize: "12px" } }, [`${roundLabel} · duel ${duelNum}/${duelsInRound}`]),
  ]));
  wrap.appendChild(el("p", { class: "mm-dim", style: { textAlign: "center", fontSize: "13px", margin: "0 0 12px" } }, ["Tapez le film qui gagne — décidez ensemble ! 📱"]));

  const cardA = el("div", {
    class: "mm-vs-duel", style: { transform: picked === a.id ? "scale(1.03)" : "scale(1)", outline: picked === a.id ? "3px solid var(--match)" : "none" },
    onClick: () => pick(a),
  }, [MovieCard(a, { compact: true })]);
  wrap.appendChild(cardA);

  wrap.appendChild(el("div", { class: "mm-vs-sep" }, [
    el("div", { class: "mm-vs-sep-line" }),
    el("span", { class: "mm-vs-sep-label" }, ["VS"]),
    el("div", { class: "mm-vs-sep-line" }),
  ]));

  const cardB = el("div", {
    class: "mm-vs-duel", style: { transform: picked === b.id ? "scale(1.03)" : "scale(1)", outline: picked === b.id ? "3px solid var(--match)" : "none" },
    onClick: () => pick(b),
  }, [MovieCard(b, { compact: true })]);
  wrap.appendChild(cardB);

  container.appendChild(wrap);
}
