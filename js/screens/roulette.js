// Décision éclair — sans salle ni prénom. Animation "machine à sous" qui ralentit sur ~2,6 s.
import { el } from "../lib/dom.js";
import { state, setState } from "../state.js";
import { MovieCard } from "../components/movie-card.js";
import { FilmLoader } from "../components/film-loader.js";
import { MOODS, moodPool } from "../data/moods.js";
import { loadLists } from "../lib/local-lists.js";
import { goHome } from "../actions.js";

let ui = { items: [], txt: "", phase: "input", spinTitle: "", winner: null, seededFor: undefined, moodBusy: false, moodErr: "" };

function backOut() {
  if (state.rouletteSeed) setState({ screen: "lists" });
  else goHome();
}

async function runMood(mood) {
  ui.moodErr = ""; ui.moodBusy = true; setState({});
  try {
    const pool = await moodPool(mood);
    ui.moodBusy = false;
    if (pool.length < 2) { ui.moodErr = "Pas assez de résultats pour cette humeur — réessaie."; setState({}); return; }
    spin(pool);
  } catch {
    ui.moodBusy = false;
    ui.moodErr = "Impossible de charger des films pour l'instant — vérifie ta connexion.";
    setState({});
  }
}

function resetIfNeeded() {
  if (ui.seededFor === state.rouletteSeed) return;
  ui.seededFor = state.rouletteSeed;
  ui.items = state.rouletteSeed || [];
  ui.txt = ""; ui.winner = null; ui.phase = "input";
  if (state.rouletteSeed && state.rouletteSeed.length >= 2) {
    setTimeout(() => spin(state.rouletteSeed), 0);
  }
}

function spin(pool) {
  if (pool.length < 2) return;
  ui.items = pool;
  const w = pool[Math.floor(Math.random() * pool.length)];
  ui.winner = w; ui.phase = "spin"; ui.spinTitle = pool[0].title;
  setState({});
  let elapsed = 0, delay = 60;
  const step = () => {
    ui.spinTitle = pool[Math.floor(Math.random() * pool.length)].title;
    elapsed += delay; delay = Math.min(280, delay * 1.14);
    setState({});
    if (elapsed < 2600) setTimeout(step, delay);
    else {
      ui.spinTitle = w.title;
      setState({});
      setTimeout(() => { ui.phase = "done"; setState({}); }, 400);
    }
  };
  setTimeout(step, delay);
}

function addTxt() {
  const lines = ui.txt.split(/\n|,|;/).map((s) => s.replace(/^[\s\d.)\-•·*]+/, "").trim()).filter((s) => s.length > 1).slice(0, 20);
  if (!lines.length) return;
  const add = lines.map((t, i) => ({ id: "r" + Date.now() + i, title: t.slice(0, 60), genre: "Perso", year: "", dur: "", pitch: "Le hasard a parlé 🎲" }));
  const seen = new Set(ui.items.map((m) => m.title.toLowerCase()));
  ui.items = [...ui.items, ...add.filter((m) => !seen.has(m.title.toLowerCase()))];
  ui.txt = "";
  setState({});
}

function renderInput(wrap) {
  wrap.appendChild(el("button", {
    class: "mm-btn mm-btn-ghost", style: { marginBottom: "14px" },
    onClick: backOut,
  }, ["← Retour"]));
  wrap.appendChild(el("div", { class: "mm-title", style: { marginBottom: "4px" } }, ["🎲 DÉCISION ÉCLAIR"]));
  wrap.appendChild(el("p", { class: "mm-dim", style: { fontSize: "13px", margin: "0 0 14px", lineHeight: "1.4" } }, [
    "Balance vos propositions, l'app tranche. Sans salle, sans prénom, sans débat.",
  ]));

  wrap.appendChild(el("div", { style: { fontSize: "11px", color: "var(--marquee)", letterSpacing: "1px", fontWeight: "700", marginBottom: "8px" } }, [
    "SELON VOTRE HUMEUR — un tap, le sort tranche",
  ]));
  const moodWrap = el("div", { style: { display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "8px" } });
  MOODS.forEach((mo) => {
    moodWrap.appendChild(el("button", { class: "mm-chip", disabled: ui.moodBusy, onClick: () => runMood(mo) }, [`${mo.emoji} ${mo.label}`]));
  });
  wrap.appendChild(moodWrap);
  if (ui.moodBusy) wrap.appendChild(el("p", { class: "mm-dim", style: { fontSize: "13px", margin: "0 0 8px" } }, ["Recherche de films…"]));
  if (ui.moodErr) wrap.appendChild(el("p", { class: "mm-error", style: { fontSize: "13px", margin: "0 0 8px" } }, [ui.moodErr]));

  wrap.appendChild(el("div", { style: { fontSize: "11px", color: "var(--dim)", letterSpacing: "1px", fontWeight: "700", marginBottom: "6px" } }, ["OU VOS PROPOSITIONS"]));
  wrap.appendChild(el("textarea", {
    class: "mm-textarea", rows: 3, value: ui.txt,
    placeholder: "Un film par ligne (ou séparés par des virgules) :\nDune 2, Oppenheimer, La Haine",
    onInput: (e) => { ui.txt = e.target.value; },
  }));
  if (ui.txt.trim()) {
    wrap.appendChild(el("button", {
      class: "mm-btn mm-btn-ghost", style: { width: "100%", padding: "10px", marginTop: "8px", color: "var(--marquee)" },
      onClick: addTxt,
    }, ["+ Ajouter aux propositions"]));
  }

  const lists = loadLists().filter((l) => Array.isArray(l.movies) && l.movies.length >= 2).slice(0, 5);
  if (lists.length > 0) {
    wrap.appendChild(el("div", { style: { fontSize: "11px", color: "var(--dim)", letterSpacing: "1px", fontWeight: "700", margin: "12px 0 6px" } }, ["OU DEPUIS UNE LISTE"]));
    const listWrap = el("div", { style: { display: "flex", flexWrap: "wrap", gap: "6px" } });
    lists.forEach((l) => {
      listWrap.appendChild(el("button", { class: "mm-chip", onClick: () => spin(l.movies) }, [`🎲 ${l.name} (${l.movies.length})`]));
    });
    wrap.appendChild(listWrap);
  }

  if (ui.items.length > 0) {
    wrap.appendChild(el("div", { style: { margin: "16px 0 6px", fontSize: "12px", color: "var(--dim)", letterSpacing: "1px", fontWeight: "700" } }, [`PROPOSITIONS · ${ui.items.length}`]));
  }
  ui.items.forEach((m, i) => {
    wrap.appendChild(el("div", { style: { display: "flex", alignItems: "center", gap: "10px", padding: "7px 10px", background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "10px", marginBottom: "6px" } }, [
      el("span", { style: { flex: "1", fontSize: "14px" } }, [m.title]),
      el("button", {
        style: { background: "transparent", border: "none", color: "var(--nope)", fontSize: "16px", cursor: "pointer" },
        onClick: () => { ui.items = ui.items.filter((_, j) => j !== i); setState({}); },
      }, ["✕"]),
    ]));
  });

  wrap.appendChild(el("button", {
    class: "mm-btn mm-btn-primary", style: { marginTop: "12px", opacity: ui.items.length < 2 ? "0.5" : "1" },
    disabled: ui.items.length < 2,
    onClick: () => spin(ui.items),
  }, [ui.items.length < 2 ? "Ajoute au moins 2 propositions" : `🎲 Tirer au sort (${ui.items.length})`]));
}

function renderSpin(wrap) {
  wrap.style.textAlign = "center";
  wrap.appendChild(el("div", { style: { fontFamily: "var(--font-display)", fontSize: "22px", letterSpacing: "2px", color: "var(--dim)", margin: "30px 0 18px" } }, ["🎲 LE SORT DÉCIDE…"]));
  wrap.appendChild(el("div", { style: { background: "var(--marquee)", color: "#1a1206", borderRadius: "14px", padding: "26px 18px", margin: "0 0 18px", overflow: "hidden" } }, [
    el("div", { style: { fontFamily: "var(--font-display)", fontSize: "34px", letterSpacing: "1px", lineHeight: "1" } }, [ui.spinTitle]),
  ]));
  wrap.appendChild(FilmLoader({ inline: true, text: "" }));
}

function renderDone(wrap) {
  wrap.appendChild(el("div", { style: { textAlign: "center", margin: "10px 0 14px" } }, [
    el("div", { style: { fontSize: "40px" } }, ["🎲"]),
    el("div", { style: { fontFamily: "var(--font-display)", fontSize: "30px", letterSpacing: "2px", color: "var(--marquee)" } }, ["LE SORT A CHOISI"]),
  ]));
  wrap.appendChild(el("div", { style: { position: "relative", height: "380px" } }, [MovieCard(ui.winner)]));
  wrap.appendChild(el("div", { style: { display: "flex", gap: "10px", marginTop: "16px" } }, [
    el("button", { class: "mm-btn mm-btn-vote", style: { borderColor: "#ffc53d66", color: "var(--marquee)" }, onClick: () => spin(ui.items) }, ["🎲 Rejouer"]),
    el("button", {
      class: "mm-btn mm-btn-vote", style: { borderColor: "var(--line)", color: "var(--dim)" },
      onClick: () => {
        const rest = ui.items.filter((m) => m.id !== ui.winner.id);
        if (rest.length >= 2) spin(rest);
        else { ui.items = rest; ui.phase = "input"; setState({}); }
      },
    }, ["Sans celui-là"]),
  ]));
  wrap.appendChild(el("button", {
    class: "mm-btn mm-btn-primary", style: { marginTop: "12px" },
    onClick: backOut,
  }, ["C'est réglé ✔"]));
}

export function renderRoulette(container) {
  resetIfNeeded();
  const wrap = el("div", { style: { marginTop: "8px" } });

  if (ui.phase === "spin") renderSpin(wrap);
  else if (ui.phase === "done" && ui.winner) renderDone(wrap);
  else renderInput(wrap);

  container.appendChild(wrap);
}
