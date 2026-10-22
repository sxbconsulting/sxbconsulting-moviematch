// Préférences mémorisées sur l'appareil (localStorage) : prénom, son, plateformes, dernière salle.
// + identifiant d'appareil (sert à repérer deux personnes avec le même prénom dans une salle).
import { ROOM_TTL } from "./utils.js";

const KEY = "mm:prefs";

function read() {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch { return {}; }
}
let prefs = read();

export function getPrefs() { return prefs; }

export function savePrefs(patch) {
  prefs = { ...prefs, ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch {}
  return prefs;
}

export function getDeviceId() {
  if (!prefs.device) savePrefs({ device: Math.random().toString(36).slice(2, 10) });
  return prefs.device;
}

export function getLastRoom() {
  const lr = prefs.lastRoom;
  return lr && lr.code && Date.now() - lr.at < ROOM_TTL ? lr : null;
}

export function rememberRoom(code, name) {
  savePrefs({ lastRoom: { code, at: Date.now() }, name });
}
