// État central de l'app — remplace les useState de React.
// setState() modifie l'état puis redéclenche un rendu complet (voir app.js).
let onChange = () => {};

export const state = {
  screen: "home", // home | setup | swipe | results | versus | roulette | lists | listBuilder
  name: "",
  code: "",
  joinCode: "",
  deck: [],
  votes: {},
  idx: 0,
  players: [],
  err: "",
  busy: false,
  local: false, // mode hors-ligne si Supabase est indisponible
  vsPool: [],
  winner: null,
  vsBack: "results",
  ficheFor: null,
  rouletteSeed: null,
  listEditing: null,
};

export function setState(patch) {
  Object.assign(state, patch);
  onChange();
}

export function onStateChange(fn) {
  onChange = fn;
}
