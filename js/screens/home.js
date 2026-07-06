import { el } from "../lib/dom.js";
import { state, setState } from "../state.js";
import { cleanName } from "../lib/utils.js";
import { getSession, getPlayer, upsertPlayer } from "../lib/backend.js";
import { resetSetupState } from "./setup.js";

function goSetup() {
  if (!cleanName(state.name)) { setState({ err: "Mets ton prénom d'abord !" }); return; }
  resetSetupState();
  setState({ err: "", screen: "setup" });
}

async function joinSession() {
  const n = cleanName(state.name);
  const c = state.joinCode.trim().toUpperCase();
  if (!n) { setState({ err: "Mets ton prénom d'abord !" }); return; }
  if (c.length !== 4) { setState({ err: "Le code fait 4 lettres." }); return; }
  setState({ busy: true, err: "" });
  const meta = await getSession(c);
  if (!meta) {
    setState({ busy: false, err: `Aucune salle "${c}" trouvée — vérifie le code (ou la synchro est indisponible ici).` });
    return;
  }
  const deck = Array.isArray(meta.movies) ? meta.movies : [];
  const existing = await getPlayer(c, n);
  const votes = existing?.votes || {};
  await upsertPlayer(c, n, { votes, done: existing?.done || false });
  const first = deck.findIndex((m) => !(m.id in votes));
  setState({
    busy: false, local: false, code: c, deck, votes,
    idx: first === -1 ? deck.length : first,
    screen: first === -1 ? "results" : "swipe",
  });
}

export function renderHome(container) {
  const wrap = el("div", {});

  wrap.appendChild(el("p", { class: "mm-subtitle" }, ["Fini les 45 min à choisir. Chacun swipe, on regarde le match. 🎬"]));

  wrap.appendChild(
    el("button", {
      class: "mm-btn mm-btn-primary outline",
      style: { marginBottom: "24px" },
      onClick: () => setState({ rouletteSeed: null, screen: "roulette" }),
    }, ["🎲 Décision éclair — l'app choisit pour vous"])
  );

  wrap.appendChild(el("label", { class: "mm-label" }, ["Ton prénom"]));
  wrap.appendChild(
    el("input", {
      class: "mm-input", value: state.name, placeholder: "Billal", maxlength: 20,
      onInput: (e) => { state.name = e.target.value; },
    })
  );

  wrap.appendChild(
    el("button", {
      class: "mm-btn mm-btn-primary", style: { marginTop: "20px" },
      disabled: state.busy, onClick: goSetup,
    }, ["Créer une salle"])
  );

  wrap.appendChild(
    el("div", { class: "mm-divider" }, [
      el("div", { class: "mm-divider-line" }),
      el("span", { class: "mm-divider-label" }, ["OU"]),
      el("div", { class: "mm-divider-line" }),
    ])
  );

  wrap.appendChild(el("label", { class: "mm-label" }, ["Code de la salle"]));
  const joinRow = el("div", { style: { display: "flex", gap: "10px" } }, [
    el("input", {
      class: "mm-input code", style: { flex: "1" }, value: state.joinCode, placeholder: "KINO", maxlength: 4,
      onInput: (e) => { state.joinCode = e.target.value.toUpperCase(); },
    }),
    el("button", {
      class: "mm-btn mm-btn-primary", style: { width: "auto", padding: "0 22px" },
      disabled: state.busy, onClick: joinSession,
    }, ["Rejoindre"]),
  ]);
  wrap.appendChild(joinRow);

  if (state.err) wrap.appendChild(el("p", { class: "mm-error" }, [state.err]));

  wrap.appendChild(
    el("button", {
      class: "mm-btn mm-btn-ghost", style: { width: "100%", padding: "13px", marginTop: "24px", fontSize: "14px" },
      onClick: () => setState({ screen: "lists" }),
    }, ["📚 Mes listes de films · ⚔️ VS rapide"])
  );

  wrap.appendChild(
    el("p", { class: "mm-dim", style: { fontSize: "12px", marginTop: "20px", lineHeight: "1.5" } }, [
      "ℹ️ Les films et votes d'une salle sont partagés entre tous ceux qui ont le code.",
    ])
  );

  container.appendChild(wrap);
}
