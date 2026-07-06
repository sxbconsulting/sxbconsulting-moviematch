// Point d'entrée + routeur — remplace le composant App/Header de React.
// Rendu simple : à chaque setState(), on vide #app et on reconstruit l'écran courant.
// (Le focus des champs texte est restauré après coup pour ne pas perdre la frappe.)
import { state, onStateChange } from "./state.js";
import { el, clear } from "./lib/dom.js";
import { FilmLoader } from "./components/film-loader.js";
import { renderHome } from "./screens/home.js";
import { renderSetup } from "./screens/setup.js";
import { renderSwipe } from "./screens/swipe.js";
import { renderResults } from "./screens/results.js";
import { renderVersus } from "./screens/versus.js";
import { renderRoulette } from "./screens/roulette.js";
import { renderLists } from "./screens/lists.js";
import { renderListBuilder } from "./screens/list-builder.js";
import { renderFiche } from "./screens/fiche.js";
import { cleanName } from "./lib/utils.js";
import { listPlayers, getWinner, subscribeToRoom } from "./lib/backend.js";
import { setState } from "./state.js";

const appEl = document.getElementById("app");

function renderHeader(container) {
  const logo = el("div", { class: "mm-logo" }, ["MOVIE", el("span", {}, ["MATCH"])]);
  const header = el("header", { class: "mm-header" }, [logo]);
  if (state.code) {
    const right = el("div", { class: "mm-header-right" }, [
      el("span", { class: "mm-header-count" }, [`${state.players.length} 🍿`]),
    ]);
    if (state.screen === "swipe") {
      right.appendChild(el("button", { class: "mm-btn mm-btn-ghost", onClick: () => setState({ screen: "results" }) }, ["Résultats live"]));
    }
    header.appendChild(right);
  }
  container.appendChild(header);
}

function renderOfflineBanner(container) {
  if (state.local && state.screen !== "home") {
    container.appendChild(el("div", { class: "mm-offline-banner" }, [
      "⚡ Mode hors-ligne : la synchro entre téléphones n'est pas dispo ici. Tes votes restent sur cet appareil.",
    ]));
  }
}

function renderScreen(container) {
  switch (state.screen) {
    case "home": renderHome(container); break;
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

// Synchronisation d'une salle : Supabase Realtime en priorité, polling (3,5s) en filet de
// secours si la connexion temps réel échoue ou met plus de 3s à s'établir.
let pollTimer = null;
let realtimeUnsub = null;
let activeKey = null; // code de la salle actuellement synchronisée (ou null)

async function doPoll() {
  if (!state.code) return;
  if (state.local) {
    const done = state.deck.length > 0 && state.deck.every((m) => m.id in state.votes);
    setState({ players: [{ name: cleanName(state.name) || "Toi", votes: state.votes, done }] });
    return;
  }
  const players = await listPlayers(state.code);
  const winner = await getWinner(state.code);
  setState({ players, winner: winner || state.winner });
}

function stopSync() {
  clearInterval(pollTimer); pollTimer = null;
  if (realtimeUnsub) { realtimeUnsub(); realtimeUnsub = null; }
  activeKey = null;
}

function isRoomScreen() { return state.screen === "swipe" || state.screen === "results"; }

function ensureRoomSync() {
  const onRoomScreen = isRoomScreen() && !!state.code;
  if (!onRoomScreen) { stopSync(); return; }

  // Hors-ligne : pas d'abonnement réseau, juste un instantané local à recalculer à chaque
  // passage sur l'écran (le code de salle "SOLO" ne change pas entre swipe et résultats,
  // donc le déduplicateur par code ci-dessous ne doit pas s'appliquer ici).
  if (state.local) { doPoll(); return; }

  const key = state.code;
  if (key === activeKey) return;

  stopSync();
  activeKey = key;
  doPoll(); // premier chargement immédiat

  let subscribed = false;
  const fallbackTimer = setTimeout(() => { if (!subscribed) pollTimer = setInterval(doPoll, 3500); }, 3000);
  realtimeUnsub = subscribeToRoom(state.code, {
    onPlayersChange: doPoll,
    onWinnerChange: (winner) => { if (winner) setState({ winner }); },
    onStatus: (status) => {
      if (status === "SUBSCRIBED") {
        subscribed = true; clearTimeout(fallbackTimer);
        clearInterval(pollTimer); pollTimer = null;
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        if (!pollTimer) pollTimer = setInterval(doPoll, 3500);
      }
    },
  });
}

// Sur l'écran swipe, la carte affichée ne dépend ni de `players` ni de `winner` — seul le
// compteur du header en a besoin. Sans ce garde-fou, chaque mise à jour Realtime/polling en
// arrière-plan reconstruirait la carte (et rechargerait son affiche) pour rien.
let lastSwipeKey = null;

function render() {
  // Une fiche ouverte doit toujours pouvoir se re-rendre (elle charge ses données de façon
  // asynchrone), donc on ne saute jamais le rendu complet tant qu'elle est affichée.
  const swipeKey = state.screen === "swipe" ? `${state.code}:${state.idx}:${state.deck.length}` : null;
  const canSkipBody = state.screen === "swipe" && !state.ficheFor && swipeKey === lastSwipeKey && appEl.querySelector(".mm-swipe-stage");

  if (canSkipBody) {
    const countEl = appEl.querySelector(".mm-header-count");
    if (countEl) countEl.textContent = `${state.players.length} 🍿`;
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
  if (state.busy) appEl.appendChild(FilmLoader());
  renderHeader(appEl);
  renderOfflineBanner(appEl);
  renderScreen(appEl);
  if (state.ficheFor) renderFiche(appEl);

  if (focusKey) {
    const target = appEl.querySelector(`[data-key="${CSS.escape(focusKey)}"]`);
    if (target) {
      target.focus();
      if (selStart !== null && typeof target.setSelectionRange === "function") {
        try { target.setSelectionRange(selStart, selEnd); } catch {}
      }
    }
  }

  ensureRoomSync();
}

onStateChange(render);
render();
