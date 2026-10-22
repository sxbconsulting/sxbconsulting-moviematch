// Résultats live — maquette "05 Résultats". Matchs (100 % des joueurs ont liké) en premier.
// VS direct : quand tout le monde a fini, un seul bouton pour départager (ou valider le match unique).
import { el } from "../lib/dom.js";
import { state, setState, notify } from "../state.js";
import { Ticket } from "../components/ticket.js";
import { TopBar, Poster, Empty } from "../components/ui.js";
import { icon } from "../components/icons.js";
import { goHome } from "../actions.js";
import { setWinner as saveWinner } from "../lib/backend.js";
import { shareText, titleSize, titleFont } from "../lib/utils.js";
import { fx } from "../lib/fx.js";

let prevMatches = { code: null, n: 0 };

async function crown(m) {
  fx.win();
  setState({ winner: m });
  if (!state.local && state.code) await saveWinner(state.code, m);
}

export function renderResults(container) {
  const { deck, players, code, winner, local } = state;
  const total = players.length;
  const nDone = players.filter((p) => p.done).length;
  const allDone = total >= 2 && nDone === total;

  const rows = deck.map((m) => {
    const voters = players.filter((p) => m.id in (p.votes || {}));
    const likes = voters.filter((p) => p.votes[m.id]);
    const seenBy = players.filter((p) => Array.isArray(p.seen) && p.seen.includes(m.id));
    const isMatch = total >= 2 && voters.length === total && likes.length === total;
    return { m, likes, seenBy, isMatch };
  }).filter((r) => r.likes.length || r.seenBy.length)
    .sort((a, b) => (b.isMatch - a.isMatch) || (b.likes.length - a.likes.length));
  const liked = rows.filter((r) => r.likes.length);
  const matches = rows.filter((r) => r.isMatch);
  const vsPool = (matches.length >= 2 ? matches : liked).slice(0, 8).map((r) => r.m);
  const goVS = () => setState({ vsPool, winner: null, vsBack: "results", screen: "versus" });

  // Son + vibration quand un nouveau match tombe
  if (prevMatches.code === code && matches.length > prevMatches.n) fx.match();
  prevMatches = { code, n: matches.length };

  const wrap = el("div", { class: "mm-screen" });
  wrap.appendChild(TopBar({
    onBack: () => goHome(), backLabel: "Accueil",
    right: local ? el("span", { class: "mm-note strong" }, ["Hors-ligne"]) : el("span", { class: "mm-live" }, [el("span", { class: "dot" }), "En direct"]),
  }));
  if (!local) wrap.appendChild(Ticket(code));

  // Qui a fini
  const stillSwiping = players.filter((p) => !p.done);
  const chips = el("div", { class: "mm-chips" });
  players.forEach((p) => chips.appendChild(el("span", { class: "mm-player" + (p.done ? " done" : "") }, [
    p.name, el("small", {}, [p.done ? "fini" : `${Object.keys(p.votes || {}).length}/${deck.length}`]),
  ])));
  const pcard = el("div", { class: "mm-panel" }, [
    el("div", { class: "mm-row-between" }, [
      el("span", { class: "mm-bebas26" }, [el("span", { class: "gold" }, [`${nDone}/${total}`]), " ONT FINI"]),
      stillSwiping[0] && total > 1 ? el("span", { class: "mm-note" }, [`${stillSwiping[0].name} en est à ${Object.keys(stillSwiping[0].votes || {}).length} / ${deck.length}`]) : null,
    ]),
    chips,
  ]);
  if (total < 2 && !local) pcard.appendChild(el("button", { type: "button", class: "mm-btn dashed", onClick: () => setState({ invite: true }) }, [icon("qr", 18), "En attente des potes — montre-leur le QR code"]));
  wrap.appendChild(pcard);

  if (winner) {
    wrap.appendChild(el("div", { class: "mm-winner" }, [
      Poster(winner, { w: 52, h: 78, r: 10 }),
      el("div", { class: "mm-winner-txt" }, [
        el("span", { class: "mm-kicker gold" }, [icon("trophy", 14), "FILM DE LA SOIRÉE"]),
        el("span", { class: "mm-winner-title" }, [String(winner.title).toUpperCase()]),
      ]),
    ]));
  }

  // VS direct
  if (!winner && allDone && matches.length === 1) {
    const t = String(matches[0].m.title).toUpperCase();
    wrap.appendChild(el("div", { class: "mm-cta green" }, [
      el("span", { class: "mm-kicker green" }, ["MATCH PARFAIT · TOUT LE MONDE EST CHAUD"]),
      el("span", { class: "mm-cta-title", style: { fontSize: titleFont(t, 36) } }, [t]),
      el("button", { type: "button", class: "mm-btn green", onClick: () => crown(matches[0].m) }, [icon("check", 20, { stroke: 2.6 }), "C'est réglé, on lance"]),
    ]));
  } else if (!winner && allDone && vsPool.length >= 2) {
    wrap.appendChild(el("div", { class: "mm-cta" }, [
      el("span", { class: "mm-kicker gold" }, ["TOUT LE MONDE A FINI"]),
      el("span", { class: "mm-cta-txt" }, [matches.length >= 2 ? `${matches.length} matchs à égalité. On tranche en duel ?` : `Aucun match parfait — les ${vsPool.length} plus likés s'affrontent.`]),
      el("button", { type: "button", class: "mm-btn gold", onClick: goVS }, ["Lancer le VS ", el("span", { class: "mm-btn-bebas" }, [`· ${vsPool.length} TITRES`])]),
    ]));
  }

  wrap.appendChild(el("div", { class: "mm-row-between" }, [
    el("h2", { class: "mm-h2 sm" }, ["CLASSEMENT"]),
    matches.length ? el("span", { class: "mm-note strong green" }, [`${matches.length} match${matches.length > 1 ? "s" : ""}`]) : null,
  ]));

  const list = el("div", { class: "mm-stack tight" });
  rows.forEach(({ m, likes, seenBy, isMatch }) => {
    list.appendChild(el("button", { type: "button", class: "mm-result" + (isMatch ? " match" : ""), onClick: () => setState({ ficheFor: m, ficheFromSwipe: false }) }, [
      Poster(m),
      el("span", { class: "mm-result-txt" }, [
        el("span", { class: "mm-result-line" }, [el("span", { class: "mm-result-title" }, [m.title]), isMatch ? el("span", { class: "mm-match-pill" }, ["MATCH"]) : null]),
        likes.length ? el("span", { class: "mm-result-who" }, [likes.map((p) => p.name).join(", ")]) : null,
        seenBy.length ? el("span", { class: "mm-result-who" }, [icon("eye", 13), `Déjà vu : ${seenBy.map((p) => p.name).join(", ")}`]) : null,
      ]),
      el("span", { class: "mm-result-score" + (isMatch ? " green" : likes.length < 2 ? " dim" : "") }, [`${likes.length}/${total}`]),
    ]));
  });
  if (!rows.length) list.appendChild(Empty("Personne n'a encore liké. Ça swipe…"));
  wrap.appendChild(list);

  const bottom = el("div", { class: "mm-stack" });
  if (!allDone && vsPool.length >= 2) {
    bottom.appendChild(el("button", { type: "button", class: "mm-btn gold", onClick: goVS }, [
      "Départager en VS ", el("span", { class: "mm-btn-bebas" }, [`· ${matches.length >= 2 ? `${matches.length} MATCHS` : `${vsPool.length} TITRES`}`]),
    ]));
  }
  if (deck.some((m) => !(m.id in state.votes))) {
    bottom.appendChild(el("button", {
      type: "button", class: "mm-btn dark",
      onClick: () => { const first = deck.findIndex((m) => !(m.id in state.votes)); if (first !== -1) setState({ idx: first, screen: "swipe" }); },
    }, ["Continuer à swiper"]));
  }
  if (winner) {
    bottom.appendChild(el("button", {
      type: "button", class: "mm-btn dark",
      onClick: async () => { if ((await shareText(`Ce soir on regarde ${winner.title} — tranché sur MovieMatch 🎬`)) === "copied") notify("Résultat copié"); },
    }, [icon("share", 18), "Partager le résultat"]));
  }
  wrap.appendChild(bottom);
  container.appendChild(wrap);
}
