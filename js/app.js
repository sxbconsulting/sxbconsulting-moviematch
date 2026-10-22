// Point d'entrée + routeur. Rendu simple : à chaque setState(), on vide #app et on reconstruit l'écran
// courant (le focus et la position du curseur des champs marqués data-key sont restaurés après coup).
import { state, setState, onStateChange } from "./state.js";
import { el, clear } from "./lib/dom.js";
import { FilmLoader } from "./components/film-loader.js";
import { InviteSheet } from "./components/invite.js";
import { icon } from "./components/icons.js";
import { renderHome } from "./screens/home.js";
import { renderSetup } from "./screens/setup.js";
import { renderSwipe } from "./screens/swipe.js";
import { renderResults } from "./screens/results.js";
import { renderVersus } from "./screens/versus.js";
import { renderRoulette } from "./screens/roulette.js";
import { renderLists } from "./screens/lists.js";
import { renderListBuilder } from "./screens/list-builder.js";
import { renderFiche } from "./screens/fiche.js";
import { cleanName, cleanCode, isValidCode } from "./lib/utils.js";
import { listPlayers, getWinner, subscribeToRoom } from "./lib/backend.js";
import { joinSession } from "./actions.js";
import { getPrefs } from "./lib/prefs.js";

const appEl = document.getElementById("app");

function renderOfflineBanner(container) {
  if (state.local && (state.screen === "swipe" || state.screen === "results")) {
    container.appendChild(el("div", { class: "mm-offline", role: "status" }, [
      icon("wifiOff", 18), "Mode hors-ligne : la synchro n'est pas dispo, tes votes restent sur ce téléphone.",
    ]));
  }
}

function renderScreen(container) {
  switch (state.screen) {
    case "setup": renderSetup(container); break;
    case "swipe": renderSwipe(container); break;
    case "results": renderResults(container); break;
    case "versus": renderVersus(container); break;
    case "roulette": renderRoulette(container); break;
    case "lists": renderLists(container); break;
    case "listBuilder": renderListBuilder(container); break;
    default: renderHome(container);
  }
}

// Synchronisation d'une salle : Supabase Realtime en priorité, polling (3,5s) en filet de secours.
let pollTimer = null, realtimeUnsub = null, activeKey = null;

async function doPoll() {
  if (!state.code) return;
  if (state.local) {
    const done = state.deck.length > 0 && state.deck.every((m) => m.id in state.votes);
    setState({ players: [{ name: cleanName(state.name) || "Toi", votes: state.votes, seen: state.seenIds, done }] });
    return;
  }
  const players = await listPlayers(state.code);
  const winner = await getWinner(state.code);
  setState({ players: players || state.players, winner: winner || state.winner });
}

function stopSync() {
  clearInterval(pollTimer); pollTimer = null;
  if (realtimeUnsub) { realtimeUnsub(); realtimeUnsub = null; }
  activeKey = null;
}

function ensureRoomSync() {
  const onRoom = (state.screen === "swipe" || state.screen === "results") && !!state.code;
  if (!onRoom) { stopSync(); return; }
  if (state.local) { if (state.screen === "results" && activeKey !== "local") { activeKey = "local"; doPoll(); } return; }
  if (state.code === activeKey) return;

  stopSync();
  activeKey = state.code;
  doPoll();
  let subscribed = false;
  const fallbackTimer = setTimeout(() => { if (!subscribed) pollTimer = setInterval(doPoll, 3500); }, 3000);
  realtimeUnsub = subscribeToRoom(state.code, {
    onPlayersChange: doPoll,
    onWinnerChange: (winner) => { if (winner) setState({ winner }); },
    onStatus: (status) => {
      if (status === "SUBSCRIBED") { subscribed = true; clearTimeout(fallbackTimer); clearInterval(pollTimer); pollTimer = null; }
      else if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status) && !pollTimer) pollTimer = setInterval(doPoll, 3500);
    },
  });
}

// Sur l'écran swipe, la carte ne dépend pas de `players`/`winner` : on évite de la reconstruire
// (et de recharger l'affiche) à chaque mise à jour Realtime en arrière-plan.
let lastSwipeKey = null;

function render() {
  const swipeKey = state.screen === "swipe" ? `${state.code}:${state.idx}:${state.deck.length}:${state.busy}:${state.invite}:${state.toast}` : null;
  if (state.screen === "swipe" && !state.ficheFor && swipeKey === lastSwipeKey && appEl.querySelector(".mm-swipe-stage")) {
    ensureRoomSync();
    return;
  }
  lastSwipeKey = swipeKey;

  const active = document.activeElement;
  let focusKey = null, selStart = null, selEnd = null;
  if (active && appEl.contains(active) && active.dataset && active.dataset.key) {
    focusKey = active.dataset.key;
    if ("selectionStart" in active) { selStart = active.selectionStart; selEnd = active.selectionEnd; }
  }

  clear(appEl);
  if (state.busy) appEl.appendChild(FilmLoader({ text: state.busyText || "Chargement…" }));
  renderOfflineBanner(appEl);
  renderScreen(appEl);
  if (state.ficheFor) renderFiche(appEl);
  if (state.invite && state.code && !state.local) appEl.appendChild(InviteSheet());
  if (state.toast) appEl.appendChild(el("div", { class: "mm-toast", role: "status" }, [state.toast]));

  if (focusKey) {
    const target = appEl.querySelector(`[data-key="${CSS.escape(focusKey)}"]`);
    if (target) {
      target.focus();
      if (selStart !== null && typeof target.setSelectionRange === "function") { try { target.setSelectionRange(selStart, selEnd); } catch {} }
    }
  }
  ensureRoomSync();
}

// Échap ferme la fiche ou la feuille d'invitation
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (state.ficheFor) setState({ ficheFor: null });
  else if (state.invite) setState({ invite: false });
});

onStateChange(render);
render();

// Lien d'invitation : ?salle=CODE → code pré-rempli, et on rejoint direct si le prénom est déjà connu.
try {
  const c = cleanCode(new URLSearchParams(window.location.search).get("salle"));
  if (isValidCode(c)) {
    history.replaceState(null, "", window.location.pathname); // évite de re-rejoindre à chaque rechargement
    setState({ joinCode: c });
    const n = getPrefs().name;
    if (cleanName(n || "")) joinSession(c, n);
  }
} catch {}
