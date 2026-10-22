// Swipe — maquette "03 Swipe". Glisser à droite = chaud, à gauche = passe, bouton œil = déjà vu.
// Le drag est géré directement en DOM pour rester fluide au doigt ; rendu complet seulement au vote.
import { el } from "../lib/dom.js";
import { state, setState } from "../state.js";
import { MovieCard } from "../components/movie-card.js";
import { TopBar } from "../components/ui.js";
import { icon } from "../components/icons.js";
import { cleanName } from "../lib/utils.js";
import { upsertPlayer } from "../lib/backend.js";
import { setSeen } from "../lib/seen.js";
import { fx } from "../lib/fx.js";

async function syncMe(votes, seen, done) {
  if (!state.code || !state.name || state.local) return;
  await upsertPlayer(state.code, cleanName(state.name), { votes, seen, done });
}

// opts.seen : "déjà vu" = compte comme un passe + exclu de mes prochains tirages
export function vote(liked, opts = {}) {
  const m = state.deck[state.idx];
  if (!m) return;
  const votes = { ...state.votes, [m.id]: liked };
  let seenIds = state.seenIds;
  if (opts.seen) { seenIds = [...seenIds, m.id]; setSeen(m, true); fx.seen(); }
  else if (liked) fx.like(); else fx.pass();
  const idx = state.idx + 1;
  const done = idx >= state.deck.length;
  syncMe(votes, seenIds, done);
  setState({ votes, seenIds, idx, screen: done ? "results" : "swipe" });
}

export function renderSwipe(container) {
  const m = state.deck[state.idx];
  const wrap = el("div", { class: "mm-screen gap14" });
  if (!m) { container.appendChild(wrap); return; }
  const nextM = state.deck[state.idx + 1];
  const hot = Object.values(state.votes).filter(Boolean).length;

  wrap.appendChild(TopBar({
    onBack: () => setState({ screen: "results" }), backLabel: "Résultats",
    right: el("div", { class: "mm-mini-ticket" }, [el("span", { class: "k" }, ["SALLE"]), el("span", { class: "v" }, [state.code])]),
  }));

  const steps = el("div", { class: "mm-steps", "aria-hidden": "true" });
  state.deck.forEach((d, i) => steps.appendChild(el("div", { class: i < state.idx ? "done" : i === state.idx ? "cur" : "" })));
  wrap.appendChild(el("div", { class: "mm-swipe-head" }, [
    el("div", { class: "mm-row-between" }, [
      el("span", { class: "mm-counter" }, [m.media_type === "tv" ? "TITRE " : "FILM ", el("span", { class: "gold" }, [String(state.idx + 1)]), ` / ${state.deck.length}`]),
      el("span", { class: "mm-note" }, [`${hot} chaud${hot > 1 ? "s" : ""} pour l'instant`]),
    ]),
    steps,
  ]));

  const stage = el("div", { class: "mm-swipe-stage" });
  if (nextM) stage.appendChild(el("div", { class: "mm-swipe-next", "aria-hidden": "true" }, [MovieCard(nextM, { compact: true })]));
  const dragWrap = el("div", { class: "mm-swipe-drag", role: "group", "aria-label": `${m.title} — glisse à droite si chaud, à gauche sinon` });
  let card = MovieCard(m);
  dragWrap.appendChild(card);
  stage.appendChild(dragWrap);
  wrap.appendChild(stage);

  let dragging = false, x0 = 0, dx = 0, leaving = 0, locked = false, lastStamp = null;

  function paint() {
    const stamp = leaving === 1 || dx > 30 ? "hot" : leaving === -1 || dx < -30 ? "pass" : leaving === 2 ? "seen" : null;
    const opacity = leaving ? 0.95 : Math.min(0.95, Math.abs(dx) / 110);
    if (stamp !== lastStamp) {
      const nc = MovieCard(m, { stamp, stampOpacity: opacity });
      dragWrap.replaceChild(nc, card); card = nc; lastStamp = stamp;
    } else if (stamp) {
      const s = card.querySelector(".mm-stamp"); if (s) s.style.opacity = String(opacity);
    }
    const off = leaving === 2 ? 0 : leaving ? leaving * 520 : dx;
    dragWrap.style.transform = leaving === 2 ? "translateY(-40px) scale(0.9)" : `translateX(${off}px) rotate(${off / 18}deg)`;
    dragWrap.style.transition = dragging ? "none" : "transform .22s ease, opacity .22s ease";
    dragWrap.style.opacity = leaving ? "0" : "1";
  }

  function commit(dir) {
    if (locked) return; // anti double-tap : un seul vote par carte
    locked = true; leaving = dir; paint();
    setTimeout(() => (dir === 2 ? vote(false, { seen: true }) : vote(dir === 1)), 220);
  }

  dragWrap.addEventListener("pointerdown", (e) => {
    if (locked) return;
    dragging = true; x0 = e.clientX; dx = 0;
    try { dragWrap.setPointerCapture(e.pointerId); } catch {}
  });
  dragWrap.addEventListener("pointermove", (e) => { if (!dragging) return; dx = e.clientX - x0; paint(); });
  const end = () => {
    if (!dragging) return;
    dragging = false;
    if (dx > 90) commit(1); else if (dx < -90) commit(-1); else { dx = 0; paint(); }
  };
  dragWrap.addEventListener("pointerup", end);
  dragWrap.addEventListener("pointercancel", end);
  paint();

  wrap.appendChild(el("div", { class: "mm-swipe-actions" }, [
    el("button", { type: "button", class: "mm-round lg nope", "aria-label": "Passe", onClick: () => commit(-1) }, [icon("x", 30, { stroke: 2.5 })]),
    el("button", { type: "button", class: "mm-round", "aria-label": "Déjà vu", onClick: () => commit(2) }, [icon("eye", 20)]),
    el("button", { type: "button", class: "mm-round", "aria-label": "Infos du film", onClick: () => setState({ ficheFor: m, ficheFromSwipe: true }) }, [icon("info", 22)]),
    el("button", { type: "button", class: "mm-round lg hot", "aria-label": "Chaud", onClick: () => commit(1) }, [icon("flame", 30, { stroke: 2.2 })]),
  ]));
  wrap.appendChild(el("p", { class: "mm-legend" }, ["Passe · Déjà vu · Infos · Chaud"]));
  container.appendChild(wrap);
}
