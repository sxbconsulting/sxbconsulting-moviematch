// Actions partagées entre plusieurs écrans (créer une salle depuis Setup ou depuis Lists, etc.)
import { state, setState } from "./state.js";
import { cleanName, randCode } from "./lib/utils.js";
import { createSession, upsertPlayer } from "./lib/backend.js";

// Retour à l'accueil en oubliant la salle courante — sans ça, `state.code` resterait celui
// de la dernière salle et un VS/roulette fait depuis "Mes listes" écrirait son gagnant dedans.
export function goHome(extra = {}) {
  setState({
    screen: "home", code: "", deck: [], votes: {}, idx: 0, players: [],
    winner: null, local: false, vsPool: [], vsBack: "results", ficheFor: null, rouletteSeed: null,
    ...extra,
  });
}

export async function launchSession(movies) {
  if (!movies.length) return;
  const n = cleanName(state.name);
  if (!n) { goHome({ err: "Mets ton prénom d'abord !" }); return; }

  setState({ busy: true, err: "", winner: null });
  const code = randCode();
  const ok = await createSession(code, movies);

  if (!ok) {
    // Stockage indisponible → mode hors-ligne, on lance quand même en solo.
    setState({ busy: false, local: true, code: "SOLO", deck: movies, votes: {}, idx: 0, screen: "swipe" });
    return;
  }

  await upsertPlayer(code, n, { votes: {}, done: false });
  setState({ busy: false, local: false, code, deck: movies, votes: {}, idx: 0, screen: "swipe" });
}
