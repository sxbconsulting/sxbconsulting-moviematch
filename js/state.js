// État central de l'app — setState() modifie l'état puis redéclenche un rendu complet (voir app.js).
import { getPrefs } from "./lib/prefs.js";

let onChange = () => {};

export const state = {
  screen: "home", // home | setup | swipe | results | versus | roulette | lists | listBuilder
  name: getPrefs().name || "",
  code: "",
  joinCode: "",
  deck: [],
  votes: {},
  seenIds: [],      // films de la salle marqués "déjà vu" par moi
  idx: 0,
  players: [],
  err: "",
  busy: false,
  busyText: "",
  local: false,     // mode hors-ligne si Supabase est indisponible
  vsPool: [],
  winner: null,
  vsBack: "results",
  ficheFor: null,
  ficheFromSwipe: false,
  rouletteSeed: null,
  listEditing: null,
  invite: false,    // feuille "Inviter la bande" (QR code)
  toast: "",
};

export function setState(patch) {
  Object.assign(state, patch);
  onChange();
}

export function onStateChange(fn) {
  onChange = fn;
}

let toastTimer = null;
export function notify(text) {
  clearTimeout(toastTimer);
  setState({ toast: text });
  toastTimer = setTimeout(() => setState({ toast: "" }), 2200);
}
