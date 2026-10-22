// Tournoi VS — maquettes "06 VS duel" et "07 VS champion". Tap = gagnant, byes si impair.
import { el } from "../lib/dom.js";
import { state, setState, notify } from "../state.js";
import { MovieCard } from "../components/movie-card.js";
import { TopBar, Empty } from "../components/ui.js";
import { icon } from "../components/icons.js";
import { setWinner as saveWinner } from "../lib/backend.js";
import { shareText, titleSize, titleFont } from "../lib/utils.js";
import { fx } from "../lib/fx.js";

// État transitoire du tournoi (réinitialisé quand le pool change).
let t = null;
function reset() { t = { pool: state.vsPool, round: state.vsPool, next: [], i: 0, champ: null, picked: null, beaten: {} }; }
const backLabel = () => (state.vsBack === "lists" ? "Mes listes" : "Résultats");
const back = () => setState({ screen: state.vsBack });

async function finish(m) {
  t.champ = m; fx.win();
  setState({ winner: m });
  if (!state.local && state.code && state.vsBack === "results") await saveWinner(state.code, m);
}

function pick(m) {
  const a = t.round[t.i], b = t.round[t.i + 1];
  if (t.picked || !a || !b) return;
  const loser = m.id === a.id ? b : a;
  t.picked = m.id; fx.tap();
  t.beaten[m.id] = [...(t.beaten[m.id] || []), loser.title];
  setState({});
  setTimeout(() => {
    t.picked = null;
    const n = [...t.next, m];
    const ni = t.i + 2;
    if (ni + 1 < t.round.length) { t.next = n; t.i = ni; }
    else {
      const list = ni < t.round.length ? [...n, t.round[ni]] : n; // impair → qualifié d'office
      if (list.length === 1) { finish(list[0]); return; }
      t.round = list; t.next = []; t.i = 0;
    }
    setState({});
  }, 380);
}

function renderChampion(container) {
  const c = t.champ;
  const title = String(c.title).toUpperCase();
  const path = t.beaten[c.id] || [];
  const conf = el("div", { class: "mm-confetti", "aria-hidden": "true" });
  [[10, 60, "#f3f1ea", 0], [77, 20, "#1a1206", -2], [46, 120, "#4ade80", -4], [87, 220, "#f3f1ea", -1], [23, 300, "#1a1206", -3], [64, 380, "#f3f1ea", -5]]
    .forEach(([l, top, c2, d]) => conf.appendChild(el("span", { style: { left: l + "%", top: top + "px", background: c2, animationDelay: d + "s" } })));

  container.appendChild(el("div", { class: "mm-champion" }, [
    conf,
    el("div", { class: "mm-champion-in" }, [
      TopBar({ onBack: back, backLabel: backLabel(), dark: true }),
      el("div", { class: "mm-trophy" }, [icon("trophy", 64, { stroke: 1.6 })]),
      el("span", { class: "mm-kicker gold wide" }, ["CHAMPION DE LA SOIRÉE"]),
      el("h1", { class: "mm-champion-title", style: { fontSize: titleFont(title, 76) } }, [title]),
      el("p", { class: "mm-champion-meta" }, [[c.year, c.genre, c.dur].filter(Boolean).join(" · ")]),
      path.length ? el("div", { class: "mm-path" }, [
        el("span", { class: "mm-note" }, ["Son parcours"]),
        el("span", {}, [`a battu ${path.length > 1 ? `${path.slice(0, -1).join(", ")} et ${path[path.length - 1]}` : path[0]}`]),
      ]) : null,
      el("div", { class: "mm-stack push" }, [
        el("button", { type: "button", class: "mm-btn gold", onClick: back }, ["Lancer la soirée"]),
        el("div", { class: "mm-row" }, [
          el("button", { type: "button", class: "mm-btn dark md", onClick: () => { reset(); setState({ winner: null }); } }, [icon("refresh", 16), "Rejouer le VS"]),
          el("button", {
            type: "button", class: "mm-btn dark md",
            onClick: async () => { if ((await shareText(`Ce soir on regarde ${c.title} — champion du VS MovieMatch 🏆`)) === "copied") notify("Résultat copié"); },
          }, [icon("share", 16), "Partager"]),
        ]),
      ]),
    ]),
  ]));
}

export function renderVersus(container) {
  if (!t || t.pool !== state.vsPool) reset();
  if (t.champ) { renderChampion(container); return; }

  const wrap = el("div", { class: "mm-screen gap14" });
  const a = t.round[t.i], b = t.round[t.i + 1];
  if (!a || !b) {
    wrap.appendChild(TopBar({ onBack: back, backLabel: backLabel() }));
    wrap.appendChild(Empty("Il faut au moins 2 titres pour un VS."));
    container.appendChild(wrap); return;
  }
  const n = t.round.length;
  const duels = Math.floor(n / 2), duelNum = Math.floor(t.i / 2) + 1;
  const label = n === 2 ? "FINALE" : n <= 4 ? "DEMI-FINALES" : n <= 8 ? "QUARTS DE FINALE" : `${n} EN LICE`;

  wrap.appendChild(TopBar({ onBack: back, backLabel: backLabel(), right: el("span", { class: "mm-note" }, ["Tape sur ton préféré"]) }));
  const dots = el("div", { class: "mm-dots", "aria-hidden": "true" });
  for (let k = 0; k < duels; k++) dots.appendChild(el("span", { class: k < duelNum - 1 ? "done" : k === duelNum - 1 ? "cur" : "" }));
  wrap.appendChild(el("div", { class: "mm-vs-head" }, [
    el("span", { class: "mm-vs-round" }, [label]),
    el("div", { class: "mm-row-center" }, [el("span", { class: "mm-note strong light" }, [`Duel ${duelNum}/${duels}`]), dots]),
  ]));

  const duel = (m) => el("button", {
    type: "button", class: "mm-duel" + (t.picked ? (t.picked === m.id ? " win" : " lose") : ""),
    "aria-label": `Choisir ${m.title}`, onClick: () => pick(m),
  }, [MovieCard(m, { compact: true, selected: t.picked === m.id })]);

  wrap.appendChild(el("div", { class: "mm-duels" }, [duel(a), el("div", { class: "mm-vs-badge", "aria-hidden": "true" }, ["VS"]), duel(b)]));
  wrap.appendChild(el("div", { class: "mm-row-center" }, [
    el("button", { type: "button", class: "mm-btn ghost fit", onClick: () => pick(Math.random() < 0.5 ? a : b) }, [icon("dice", 16), "Égalité, on tire au sort"]),
  ]));
  container.appendChild(wrap);
}
