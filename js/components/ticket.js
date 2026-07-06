// Ticket de cinéma jaune perforé — affiche le code de salle + bouton copier.
import { el } from "../lib/dom.js";

export function Ticket(code) {
  const copy = () => {
    try { navigator.clipboard.writeText(code); } catch {}
  };
  return el("div", { class: "mm-ticket" }, [
    el("div", {}, [
      el("div", { class: "mm-ticket-label" }, ["TICKET · SALLE"]),
      el("div", { class: "mm-ticket-code" }, [code]),
    ]),
    el("button", { class: "mm-ticket-copy", onClick: copy }, ["Copier"]),
  ]);
}
