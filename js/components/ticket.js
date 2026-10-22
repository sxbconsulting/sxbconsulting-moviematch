// Ticket de cinéma jaune perforé — code de salle + boutons Inviter (QR) et Copier.
import { el } from "../lib/dom.js";
import { icon } from "./icons.js";
import { copyText } from "../lib/utils.js";
import { setState, notify } from "../state.js";

export function Ticket(code) {
  return el("div", { class: "mm-ticket" }, [
    el("div", { class: "mm-ticket-main" }, [
      el("span", { class: "mm-ticket-label" }, ["ADMIT ONE · SALLE"]),
      el("span", { class: "mm-ticket-code" }, [code]),
    ]),
    el("div", { class: "mm-ticket-stub" }, [
      el("button", { type: "button", class: "mm-ticket-btn dark", onClick: () => setState({ invite: true }) }, [icon("qr", 16), "Inviter"]),
      el("button", {
        type: "button", class: "mm-ticket-btn",
        onClick: async () => notify((await copyText(code)) ? "Code copié" : "Copie impossible ici"),
      }, [icon("copy", 15), "Copier"]),
    ]),
  ]);
}
