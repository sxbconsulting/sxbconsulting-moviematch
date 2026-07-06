// Écran de swipe — glisser une carte à gauche (passe) ou à droite (chaud).
// Le drag est géré directement en DOM (pas via setState) pour rester fluide au doigt ;
// on ne redéclenche un rendu complet qu'à la fin du geste (vote).
import { el } from "../lib/dom.js";
import { state, setState } from "../state.js";
import { MovieCard } from "../components/movie-card.js";
import { cleanName } from "../lib/utils.js";
import { upsertPlayer } from "../lib/backend.js";

async function syncMe(votes, done) {
  if (!state.code || !state.name || state.local) return;
  await upsertPlayer(state.code, cleanName(state.name), { votes, done });
}

function vote(liked) {
  const m = state.deck[state.idx];
  if (!m) return;
  const votes = { ...state.votes, [m.id]: liked };
  const idx = state.idx + 1;
  const done = idx >= state.deck.length;
  syncMe(votes, done);
  setState({ votes, idx, screen: done ? "results" : "swipe" });
}

export function renderSwipe(container) {
  const m = state.deck[state.idx];
  const wrap = el("div", { style: { marginTop: "8px" } });
  if (!m) { container.appendChild(wrap); return; }

  const nextM = state.deck[state.idx + 1];

  wrap.appendChild(el("div", { class: "mm-swipe-meta" }, [
    el("span", {}, [`Film ${Math.min(state.idx + 1, state.deck.length)} / ${state.deck.length}`]),
    el("span", {}, ["← passe · chaud →"]),
  ]));

  const stage = el("div", { class: "mm-swipe-stage" });
  if (nextM) stage.appendChild(MovieCard(nextM, { extraStyle: { transform: "scale(0.94) translateY(14px)", opacity: "0.5" } }));

  const dragWrap = el("div", { class: "mm-swipe-drag" });
  const card = MovieCard(m, {});
  dragWrap.appendChild(card);
  stage.appendChild(dragWrap);
  wrap.appendChild(stage);

  let dragging = false, x0 = 0, dx = 0, leaving = 0, badgeEl = null;

  function updateBadge() {
    if (badgeEl) { badgeEl.remove(); badgeEl = null; }
    const hot = dx > 40 || leaving === 1;
    const pass = dx < -40 || leaving === -1;
    if (hot || pass) {
      const color = hot ? "var(--match)" : "var(--nope)";
      badgeEl = el("div", { class: "mm-card-flag", style: { borderColor: color, color } }, [hot ? "CHAUD 🔥" : "PASSE"]);
      card.appendChild(badgeEl);
    }
  }

  function applyTransform() {
    const rot = dx / 18;
    const off = leaving ? leaving * 500 : dx;
    dragWrap.style.transform = `translateX(${off}px) rotate(${rot}deg)`;
    dragWrap.style.transition = dragging ? "none" : "transform .22s ease, opacity .22s ease";
    dragWrap.style.opacity = leaving ? "0" : "1";
    updateBadge();
  }

  function commit(dir) {
    leaving = dir;
    applyTransform();
    setTimeout(() => vote(dir === 1), 220);
  }

  function onDown(e) {
    dragging = true;
    x0 = e.clientX ?? (e.touches && e.touches[0].clientX) ?? 0;
  }
  function onMove(e) {
    if (!dragging) return;
    const x = e.clientX ?? (e.touches && e.touches[0].clientX) ?? x0;
    dx = x - x0;
    applyTransform();
  }
  function onUp() {
    if (!dragging) return;
    dragging = false;
    if (dx > 90) commit(1);
    else if (dx < -90) commit(-1);
    else { dx = 0; applyTransform(); }
  }

  dragWrap.addEventListener("pointerdown", onDown);
  dragWrap.addEventListener("pointermove", onMove);
  dragWrap.addEventListener("pointerup", onUp);
  dragWrap.addEventListener("pointerleave", onUp);
  applyTransform();

  wrap.appendChild(el("div", { class: "mm-swipe-actions" }, [
    el("button", { class: "mm-btn mm-btn-vote", style: { borderColor: "#f8717166", color: "var(--nope)" }, onClick: () => commit(-1) }, ["👎 Passe"]),
    el("button", { class: "mm-btn mm-btn-vote info", onClick: () => setState({ ficheFor: m }) }, ["ℹ️"]),
    el("button", { class: "mm-btn mm-btn-vote", style: { borderColor: "#4ade8066", color: "var(--match)" }, onClick: () => commit(1) }, ["🔥 Chaud"]),
  ]));

  container.appendChild(wrap);
}
