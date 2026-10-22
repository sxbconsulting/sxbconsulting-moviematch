// Actions partagées entre plusieurs écrans : créer / rejoindre / quitter une salle.
import { state, setState } from "./state.js";
import { cleanName, cleanCode, randCode, isValidCode, pickRandom, DECK_MAX, ROOM_TTL, CODE_LEN } from "./lib/utils.js";
import { createSession, getSession, getPlayer, upsertPlayer } from "./lib/backend.js";
import { getDeviceId, rememberRoom, savePrefs } from "./lib/prefs.js";

// Retour à l'accueil en oubliant la salle courante — sans ça, `state.code` resterait celui
// de la dernière salle et un VS/roulette fait depuis "Mes listes" écrirait son gagnant dedans.
export function goHome(extra = {}) {
  setState({
    screen: "home", code: "", deck: [], votes: {}, seenIds: [], idx: 0, players: [],
    winner: null, local: false, vsPool: [], vsBack: "results", ficheFor: null, rouletteSeed: null, invite: false,
    ...extra,
  });
}

export async function launchSession(movies) {
  if (!movies.length) return;
  if (movies.length > DECK_MAX) movies = pickRandom(movies, DECK_MAX);
  const n = cleanName(state.name);
  if (!n) { goHome({ err: "Mets ton prénom d'abord !" }); return; }

  setState({ busy: true, busyText: "Création de la salle…", err: "", winner: null });
  // Code unique : on réessaie si le code tiré est déjà pris
  let code = randCode(), res = await createSession(code, movies);
  for (let i = 0; i < 3 && res === "taken"; i++) { code = randCode(); res = await createSession(code, movies); }

  if (res !== "ok") {
    // Supabase indisponible → mode hors-ligne, on lance quand même en solo.
    setState({ busy: false, local: true, code: "SOLO", deck: movies, votes: {}, seenIds: [], idx: 0, players: [{ name: n, votes: {}, done: false }], screen: "swipe" });
    return;
  }

  await upsertPlayer(code, n, { votes: {}, seen: [], device: getDeviceId(), done: false });
  rememberRoom(code, state.name.trim());
  setState({
    busy: false, local: false, code, deck: movies, votes: {}, seenIds: [], idx: 0,
    players: [{ name: n, votes: {}, done: false }], screen: "swipe",
    invite: true, // on propose tout de suite d'inviter la bande (QR code)
  });
}

// Anti force brute (côté appareil) : après 5 codes faux, 30 s d'attente.
const fails = { n: 0, until: 0 };

export async function joinSession(codeArg, nameArg) {
  const rawName = nameArg !== undefined ? nameArg : state.name;
  const n = cleanName(rawName);
  const c = cleanCode(codeArg !== undefined ? codeArg : state.joinCode);
  if (!n) { setState({ err: "Mets ton prénom d'abord !" }); return; }
  if (!isValidCode(c)) { setState({ err: `Le code fait ${CODE_LEN} lettres.` }); return; }
  if (fails.until > Date.now()) { setState({ err: `Trop d'essais — réessaie dans ${Math.ceil((fails.until - Date.now()) / 1000)} s.` }); return; }

  setState({ busy: true, busyText: "On rejoint la salle…", err: "" });
  const meta = await getSession(c);
  if (!meta) {
    fails.n += 1;
    if (fails.n >= 5) { fails.until = Date.now() + 30000; fails.n = 0; }
    setState({ busy: false, err: `Aucune salle "${c}" — vérifie le code (ou ta connexion).` });
    return;
  }
  if (meta.created_at && Date.now() - new Date(meta.created_at).getTime() > ROOM_TTL) {
    setState({ busy: false, err: "Cette salle a expiré (plus de 7 jours). Crée-en une nouvelle !" });
    return;
  }
  fails.n = 0;

  const existing = await getPlayer(c, n);
  // Même prénom déjà pris par quelqu'un d'autre → on bloque pour ne pas écraser ses votes
  if (existing && existing.device && existing.device !== getDeviceId()) {
    setState({ busy: false, err: `Le prénom "${n}" est déjà pris dans cette salle — ajoute une initiale (ex : ${n}-B).` });
    return;
  }
  const deck = Array.isArray(meta.movies) ? meta.movies : [];
  const votes = existing?.votes || {};
  const seen = existing?.seen || [];
  await upsertPlayer(c, n, { votes, seen, device: getDeviceId(), done: existing?.done || false });
  rememberRoom(c, String(rawName).trim());
  const first = deck.findIndex((m) => !(m.id in votes));
  setState({
    busy: false, local: false, code: c, deck, votes, seenIds: seen, name: String(rawName).trim(),
    winner: meta.winner || null, joinCode: "",
    idx: first === -1 ? deck.length : first,
    screen: first === -1 ? "results" : "swipe",
  });
}

export function setName(v) {
  state.name = v;
  savePrefs({ name: v.trim() });
}
