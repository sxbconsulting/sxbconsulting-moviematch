// Décision éclair — maquettes 08 (humeur + chapeau), 09 (tirage), 10 (résultat). Sans salle ni prénom.
import { el } from "../lib/dom.js";
import { state, setState } from "../state.js";
import { MovieCard } from "../components/movie-card.js";
import { TopBar, Empty } from "../components/ui.js";
import { icon } from "../components/icons.js";
import { MOODS, moodPool } from "../data/moods.js";
import { loadLists } from "../lib/local-lists.js";
import { goHome } from "../actions.js";
import { genreStyleOf } from "../data/genre-style.js";
import { normTitle, uid, titleSize, titleFont, metaLine, pickRandom } from "../lib/utils.js";
import { notSeen, setSeen } from "../lib/seen.js";
import { fx } from "../lib/fx.js";

let ui = { items: [], moods: [], moodBusy: "", err: "", txt: "", phase: "input", spinTitle: "", winner: null, seededFor: undefined };
const refresh = () => setState({});

function backOut() {
  if (state.rouletteSeed) setState({ screen: "lists" });
  else goHome();
}

function resetIfNeeded() {
  if (ui.seededFor === state.rouletteSeed) return;
  ui = { items: state.rouletteSeed ? [...state.rouletteSeed] : [], moods: [], moodBusy: "", err: "", txt: "", phase: "input", spinTitle: "", winner: null, seededFor: state.rouletteSeed };
  if (state.rouletteSeed && state.rouletteSeed.length >= 2) setTimeout(() => spin(state.rouletteSeed), 0);
}

function addItems(items, src) {
  const seen = new Set(ui.items.map((m) => normTitle(m.title)));
  ui.items = [...ui.items, ...items.filter((m) => !seen.has(normTitle(m.title))).map((m) => ({ ...m, src }))];
}

async function toggleMood(mo) {
  fx.tap();
  if (ui.moods.includes(mo.key)) {
    ui.moods = ui.moods.filter((k) => k !== mo.key);
    ui.items = ui.items.filter((m) => m.src !== mo.key);
    refresh(); return;
  }
  ui.moods = [...ui.moods, mo.key]; ui.moodBusy = mo.key; ui.err = ""; refresh();
  try {
    const pool = notSeen(await moodPool(mo));
    addItems(pickRandom(pool, 4), mo.key);
  } catch {
    ui.moods = ui.moods.filter((k) => k !== mo.key);
    ui.err = "Impossible de charger des films pour cette humeur — vérifie ta connexion.";
  }
  ui.moodBusy = ""; refresh();
}

function addTxt() {
  const lines = ui.txt.split(/\n|,|;/).map((s) => s.replace(/^[\s\d.)\-•·*]+/, "").trim()).filter((s) => s.length > 1).slice(0, 20);
  if (!lines.length) return;
  addItems(lines.map((t) => ({ id: uid("r"), title: t.slice(0, 60), genre: "Perso", year: "", dur: "", pitch: "" })), "txt");
  ui.txt = ""; refresh();
}

function spin(pool) {
  if (pool.length < 2) return;
  ui.items = pool;
  const w = pool[Math.floor(Math.random() * pool.length)];
  ui.winner = w; ui.phase = "spin"; ui.spinTitle = pool[0].title;
  refresh();
  let elapsed = 0, delay = 60;
  const step = () => {
    if (ui.phase !== "spin") return; // annulé
    ui.spinTitle = pool[Math.floor(Math.random() * pool.length)].title; fx.tick();
    elapsed += delay; delay = Math.min(300, delay * 1.14);
    refresh();
    if (elapsed < 2600) setTimeout(step, delay);
    else {
      ui.spinTitle = w.title; refresh();
      setTimeout(() => { if (ui.phase === "spin") { ui.phase = "done"; fx.win(); refresh(); } }, 420);
    }
  };
  setTimeout(step, delay);
}

function without(m) {
  const rest = ui.items.filter((x) => x.id !== m.id);
  if (rest.length >= 2) spin(rest); else { ui.items = rest; ui.phase = "input"; refresh(); }
}

function renderInput(wrap) {
  wrap.appendChild(TopBar({ onBack: backOut }));
  wrap.appendChild(el("div", {}, [
    el("h1", { class: "mm-h1 with-ico" }, [icon("bolt", 28, { color: "#ffc53d", fill: "#ffc53d", stroke: 1.5 }), "DÉCISION ÉCLAIR"]),
    el("p", { class: "mm-sub" }, ["Balance vos idées, le sort tranche. Pas de salle, pas de prénom."]),
  ]));

  const moods = el("div", { class: "mm-chips" });
  MOODS.forEach((mo) => {
    const on = ui.moods.includes(mo.key);
    moods.appendChild(el("button", { type: "button", class: "mm-chip lg" + (on ? " on" : ""), "aria-pressed": String(on), disabled: !!ui.moodBusy, onClick: () => toggleMood(mo) }, [mo.label]));
  });
  wrap.appendChild(el("div", { class: "mm-field" }, [
    el("h2", { class: "mm-label" }, ["Votre humeur ", ui.moods.length ? el("span", { class: "gold" }, [`· ${ui.moods.length} choisie${ui.moods.length > 1 ? "s" : ""}`]) : null]),
    moods,
  ]));
  if (ui.err) wrap.appendChild(el("p", { class: "mm-error" }, [ui.err]));

  wrap.appendChild(el("div", { class: "mm-field" }, [
    el("label", { class: "mm-label", for: "mm-props" }, ["Vos propositions · une par ligne"]),
    el("textarea", {
      id: "mm-props", "data-key": "roulette-txt", class: "mm-textarea", rows: 3, value: ui.txt, placeholder: "Le Dîner de cons\nMamma Mia!\n…",
      onInput: (e) => { ui.txt = e.target.value; },
    }),
    el("button", { type: "button", class: "mm-btn soft sm-h", onClick: addTxt }, [icon("plus", 16, { stroke: 2.4 }), "Ajouter au chapeau"]),
  ]));

  const lists = loadLists().filter((l) => Array.isArray(l.movies) && l.movies.length >= 2).slice(0, 6);
  if (lists.length) {
    const row = el("div", { class: "mm-chips scroll" });
    lists.forEach((l) => row.appendChild(el("button", { type: "button", class: "mm-chip", onClick: () => spin(l.movies) }, [icon("dice", 15), l.name, el("span", { class: "faint" }, [String(l.movies.length)])])));
    wrap.appendChild(el("div", { class: "mm-field" }, [el("span", { class: "mm-label" }, ["Ou tirer directement dans une liste"]), row]));
  }

  wrap.appendChild(el("div", { class: "mm-row-between" }, [el("h2", { class: "mm-h2 xs" }, ["DANS LE CHAPEAU"]), el("span", { class: "mm-big-num sm" }, [String(ui.items.length)])]));
  if (!ui.items.length) wrap.appendChild(Empty("Choisis une humeur ou écris vos idées."));
  else {
    const ul = el("ul", { class: "mm-hat" });
    ui.items.forEach((m, i) => ul.appendChild(el("li", { class: "mm-hat-item" }, [
      el("span", { class: "mm-hat-bar", style: { background: genreStyleOf(m.genre).grad } }),
      el("span", { class: "mm-hat-title" }, [m.title]),
      el("button", { type: "button", class: "mm-icon-btn ghost", "aria-label": `Retirer ${m.title}`, onClick: () => { ui.items = ui.items.filter((_, j) => j !== i); refresh(); } }, [icon("x", 18, { stroke: 2.2 })]),
    ])));
    wrap.appendChild(ul);
  }
  wrap.appendChild(el("button", { type: "button", class: "mm-btn gold xl", disabled: ui.items.length < 2, onClick: () => spin(ui.items) }, [
    icon("dice", 20), ui.items.length < 2 ? "Au moins 2 titres" : `Tirer au sort (${ui.items.length})`,
  ]));
}

function renderSpin(wrap) {
  const moodLabels = MOODS.filter((m) => ui.moods.includes(m.key)).map((m) => m.label).join(" · ");
  wrap.classList.add("mm-centered");
  wrap.appendChild(TopBar({ onBack: () => { ui.phase = "input"; refresh(); }, backLabel: "Annuler" }));
  wrap.appendChild(el("div", { class: "mm-spin-head" }, [
    el("span", { class: "mm-kicker gold wide" }, [`${ui.items.length} TITRES DANS LE CHAPEAU`]),
    el("h1", { class: "mm-h1 big" }, ["LE SORT TOURNE…"]),
  ]));
  const title = String(ui.spinTitle).toUpperCase();
  wrap.appendChild(el("div", { class: "mm-perf-line", "aria-hidden": "true" }));
  wrap.appendChild(el("div", { class: "mm-spin-ticket", role: "status", "aria-live": "polite" }, [
    el("span", { class: "mm-spin-label" }, ["ADMIT ONE · CE SOIR"]),
    el("span", { class: "mm-spin-title", style: { fontSize: titleFont(title, 44) } }, [title]),
  ]));
  wrap.appendChild(el("div", { class: "mm-perf-line", "aria-hidden": "true" }));
  if (moodLabels) wrap.appendChild(el("p", { class: "mm-note" }, [moodLabels]));
  wrap.appendChild(el("button", { type: "button", class: "mm-btn gold xl push", disabled: true }, ["Ça tourne…"]));
}

function renderDone(wrap) {
  const w = ui.winner;
  const title = String(w.title).toUpperCase();
  const pos = ui.items.findIndex((m) => m.id === w.id) + 1;
  wrap.classList.add("mm-centered");
  wrap.appendChild(TopBar({ onBack: () => { ui.phase = "input"; refresh(); } }));
  wrap.appendChild(el("span", { class: "mm-kicker gold wide" }, ["LE SORT A CHOISI"]));
  wrap.appendChild(el("div", { class: "mm-done-poster" }, [MovieCard(w, { compact: true, bare: true })]));
  wrap.appendChild(el("div", { class: "mm-done-ticket" }, [
    el("div", { class: "mm-done-main" }, [
      el("span", { class: "mm-ticket-label" }, ["CE SOIR, ON REGARDE"]),
      el("span", { class: "mm-done-title", style: { fontSize: titleFont(title, 48) } }, [title]),
      metaLine(w) ? el("span", { class: "mm-done-meta" }, [metaLine(w)]) : null,
    ]),
    el("div", { class: "mm-done-stub" }, [el("span", { class: "n" }, [String(pos)]), el("span", {}, [`sur ${ui.items.length}`])]),
  ]));
  wrap.appendChild(el("div", { class: "mm-stack push full" }, [
    el("button", { type: "button", class: "mm-btn green", onClick: backOut }, [icon("check", 20, { stroke: 2.6 }), "C'est réglé"]),
    el("div", { class: "mm-row" }, [
      el("button", { type: "button", class: "mm-btn dark", onClick: () => spin(ui.items) }, [icon("refresh", 18), "Rejouer"]),
      el("button", { type: "button", class: "mm-btn danger", onClick: () => without(w) }, [icon("x", 18, { stroke: 2.4 }), "Sans celui-là"]),
    ]),
    el("button", { type: "button", class: "mm-btn ghost sm-h", onClick: () => { setSeen(w, true); fx.seen(); without(w); } }, [icon("eye", 16), "Déjà vu — on en tire un autre"]),
  ]));
}

export function renderRoulette(container) {
  resetIfNeeded();
  const wrap = el("div", { class: "mm-screen" });
  if (ui.phase === "spin") renderSpin(wrap);
  else if (ui.phase === "done" && ui.winner) renderDone(wrap);
  else renderInput(wrap);
  container.appendChild(wrap);
}
