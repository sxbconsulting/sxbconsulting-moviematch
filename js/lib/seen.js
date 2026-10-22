// "Déjà vu" — titres que je ne veux plus voir revenir dans les tirages (localStorage).
// Clé stable : l'id TMDB quand il existe, sinon le titre normalisé.
import { normTitle } from "./utils.js";

const KEY = "mm:seen";
let set = new Set(read());

function read() {
  try { const a = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(a) ? a : []; } catch { return []; }
}
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify([...set].slice(-800))); } catch {}
}

export const seenKey = (m) => (m && m.tmdb_id ? `${m.media_type}-${m.tmdb_id}` : "t:" + normTitle(m && m.title));
export const isSeen = (m) => set.has(seenKey(m));
export const seenCount = () => set.size;
export const notSeen = (items) => items.filter((m) => !isSeen(m));

export function setSeen(m, on = true) {
  const k = seenKey(m);
  if (on) set.add(k); else set.delete(k);
  persist();
}
export function toggleSeen(m) { setSeen(m, !isSeen(m)); }
export function resetSeen() { set = new Set(); persist(); }
