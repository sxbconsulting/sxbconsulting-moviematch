// Accueil — maquette "Main" : éventail d'affiches, titre, reprise de salle, décision éclair, prénom, code.
import { el } from "../lib/dom.js";
import { state, setState } from "../state.js";
import { cleanName, cleanCode, CODE_LEN } from "../lib/utils.js";
import { icon } from "../components/icons.js";
import { joinSession, setName } from "../actions.js";
import { getLastRoom, getPrefs, savePrefs } from "../lib/prefs.js";
import { fx } from "../lib/fx.js";
import { resetSetupState } from "./setup.js";

function goSetup() {
  if (!cleanName(state.name)) { setState({ err: "Mets ton prénom d'abord !" }); return; }
  setName(state.name);
  resetSetupState();
  setState({ err: "", screen: "setup" });
}

export function renderHome(container) {
  const sound = getPrefs().sound !== false;
  const lastRoom = getLastRoom();
  const wrap = el("div", { class: "mm-screen mm-home" });

  wrap.appendChild(el("div", { class: "mm-home-top" }, [
    el("button", {
      type: "button", class: "mm-icon-btn round" + (sound ? " gold-ink" : ""), "aria-pressed": String(sound),
      "aria-label": sound ? "Couper le son et les vibrations" : "Activer le son et les vibrations",
      onClick: () => { savePrefs({ sound: !sound }); if (!sound) fx.tap(); setState({}); },
    }, [icon(sound ? "sound" : "mute", 19)]),
  ]));

  wrap.appendChild(el("div", { class: "mm-fan", "aria-hidden": "true" }, [
    el("div", { class: "mm-fan-card left" }), el("div", { class: "mm-fan-card right" }),
    el("div", { class: "mm-fan-card center" }, [el("div", { class: "mm-fan-bar" })]),
  ]));

  wrap.appendChild(el("div", { class: "mm-brand" }, [
    el("h1", { class: "mm-logo" }, ["MOVIE", el("span", {}, ["MATCH"])]),
    el("p", { class: "mm-sub" }, ["Ce soir, on regarde quoi ? On swipe, on tranche."]),
  ]));

  if (lastRoom) {
    wrap.appendChild(el("button", {
      type: "button", class: "mm-resume", disabled: state.busy,
      onClick: () => joinSession(lastRoom.code),
    }, [
      icon("door", 20),
      el("span", { class: "mm-resume-txt" }, [el("span", { class: "mm-resume-label" }, ["REPRENDRE MA SALLE"]), el("span", { class: "mm-resume-code" }, [lastRoom.code])]),
      icon("next", 20),
    ]));
  }

  wrap.appendChild(el("button", {
    type: "button", class: "mm-btn dark sm-h",
    onClick: () => setState({ rouletteSeed: null, err: "", screen: "roulette" }),
  }, [icon("bolt", 18, { color: "#ffc53d" }), "Décision éclair", el("span", { class: "mm-btn-aside" }, ["· sans prénom"])]));

  wrap.appendChild(el("div", { class: "mm-field" }, [
    el("label", { class: "mm-label", for: "mm-prenom" }, ["Ton prénom"]),
    el("input", {
      id: "mm-prenom", "data-key": "home-name", class: "mm-input", value: state.name, placeholder: "Ex. Inès", maxlength: 20, autocomplete: "given-name",
      onInput: (e) => { state.name = e.target.value; },
      onKeydown: (e) => { if (e.key === "Enter") goSetup(); },
    }),
  ]));

  wrap.appendChild(el("button", { type: "button", class: "mm-btn gold", disabled: state.busy, onClick: goSetup }, ["Créer une salle"]));

  wrap.appendChild(el("div", { class: "mm-divider", "aria-hidden": "true" }, [el("div", { class: "mm-divider-line" }), el("span", {}, ["OU"]), el("div", { class: "mm-divider-line" })]));

  wrap.appendChild(el("div", { class: "mm-field" }, [
    el("label", { class: "mm-label", for: "mm-code" }, ["Code de la salle"]),
    el("div", { class: "mm-row" }, [
      el("input", {
        id: "mm-code", "data-key": "home-code", class: "mm-input code", value: state.joinCode, placeholder: "ABCDE",
        maxlength: CODE_LEN, autocapitalize: "characters", autocomplete: "off",
        onInput: (e) => { const c = cleanCode(e.target.value); state.joinCode = c; if (e.target.value !== c) e.target.value = c; },
        onKeydown: (e) => { if (e.key === "Enter" && !state.busy) joinSession(); },
      }),
      el("button", { type: "button", class: "mm-btn soft fit", disabled: state.busy, onClick: () => joinSession() }, ["Rejoindre"]),
    ]),
  ]));

  if (state.err) wrap.appendChild(el("p", { class: "mm-error", role: "alert" }, [state.err]));

  wrap.appendChild(el("button", {
    type: "button", class: "mm-link-btn",
    onClick: () => setState({ err: "", screen: "lists" }),
  }, ["Mes listes ", el("span", { class: "gold" }, ["·"]), " VS rapide"]));

  container.appendChild(wrap);
}
