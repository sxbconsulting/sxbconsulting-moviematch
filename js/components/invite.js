// Feuille "Inviter la bande" : QR code + lien ?salle=CODE + partage / WhatsApp / copier.
import { el } from "../lib/dom.js";
import { icon } from "./icons.js";
import { Sheet } from "./ui.js";
import { qrSvg } from "../lib/qr.js";
import { inviteUrl, shareText, copyText } from "../lib/utils.js";
import { state, setState, notify } from "../state.js";

export function InviteSheet() {
  const code = state.code;
  const url = inviteUrl(code);
  const msg = `On choisit le film de ce soir sur MovieMatch 🎬 Rejoins la salle ${code} :`;
  const close = () => setState({ invite: false });

  return Sheet({
    label: "Inviter la bande", onClose: close, children: [
      el("div", { class: "mm-sheet-pad center" }, [
        el("div", { class: "mm-handle" }),
        el("div", { class: "mm-row-between full" }, [
          el("div", {}, [
            el("h2", { class: "mm-h2" }, ["INVITER LA BANDE"]),
            el("p", { class: "mm-sub tight" }, ["Ils scannent, ils sont dans la salle."]),
          ]),
          el("button", { type: "button", class: "mm-icon-btn round", "aria-label": "Fermer", onClick: close }, [icon("x", 18)]),
        ]),
        el("div", { class: "mm-qr-card" }, [
          el("div", { html: qrSvg(url, 208) }),
          el("div", { class: "mm-qr-code" }, [code]),
        ]),
        el("p", { class: "mm-url" }, [url]),
        el("div", { class: "mm-stack full" }, [
          el("button", {
            type: "button", class: "mm-btn gold",
            onClick: async () => { if ((await shareText(msg, url)) === "copied") notify("Invitation copiée — colle-la dans le groupe"); },
          }, [icon("share", 18), "Partager l'invitation"]),
          el("div", { class: "mm-row" }, [
            el("a", { class: "mm-btn dark", href: `https://wa.me/?text=${encodeURIComponent(`${msg} ${url}`)}`, target: "_blank", rel: "noreferrer" }, ["WhatsApp"]),
            el("button", { type: "button", class: "mm-btn dark", onClick: async () => notify((await copyText(url)) ? "Lien copié" : "Copie impossible ici") }, [icon("copy", 16), "Copier le lien"]),
          ]),
        ]),
      ]),
    ],
  });
}
