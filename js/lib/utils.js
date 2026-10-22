// Petites fonctions partagées par plusieurs écrans.

export const cleanName = (s) => String(s || "").trim().replace(/[\s/\\'"]+/g, "-").slice(0, 20);

// ————— Salles —————
export const CODE_LEN = 5;                       // 23^5 = 6,4 millions de codes possibles
export const ROOM_TTL = 7 * 24 * 3600 * 1000;    // une salle expire au bout de 7 jours
export const DECK_SIZE = 20;
export const DECK_MAX = 40;                      // plafond d'une salle (contrainte SQL ≤ 50)
export const APP_URL = "https://sxbconsulting.github.io/sxbconsulting-moviematch/";
export const inviteUrl = (code) => `${APP_URL}?salle=${code}`;

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ"; // sans I, L, O
export const randCode = () => Array.from({ length: CODE_LEN }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join("");
export const cleanCode = (s) => String(s || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, CODE_LEN);
// Les anciens codes (4 lettres) restent acceptés le temps qu'ils expirent.
export const isValidCode = (c) => c.length === CODE_LEN || c.length === 4;

// ————— Titres —————
export const normTitle = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
// Taille de titre qui s'adapte à la longueur (évite les débordements sur les cartes et tickets)
export function titleSize(t, max) {
  const n = String(t || "").length;
  return n <= 8 ? max : n <= 14 ? Math.round(max * 0.8) : n <= 22 ? Math.round(max * 0.66) : Math.round(max * 0.55);
}
// Variante CSS : même taille, mais jamais plus large que l'écran (le mot le plus long tient sur une ligne)
export function titleFont(t, max) {
  const longest = Math.max(4, ...String(t || "").split(/\s+/).map((w) => w.length));
  return `min(${titleSize(t, max)}px, ${Math.floor(128 / longest)}vw)`;
}
export const metaLine = (m) => [m.year, m.dur].filter(Boolean).join(" · ");

let seq = 0;
export const uid = (p = "x") => p + Date.now().toString(36) + (seq++).toString(36);

export function parsePastedLines(text, max = 40) {
  return text
    .split(/\n/)
    .map((s) => s.replace(/^[\s\d.)\-•·*]+/, "").trim())
    .filter((s) => s.length > 1)
    .slice(0, max);
}

export function pickRandom(arr, n) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

// Timeout réseau (4 s par défaut) — ne jamais bloquer l'UI.
export function withTimeout(promise, ms = 4000) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout")), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// ————— Partage —————
// Partage natif sur mobile, sinon copie dans le presse-papiers.
export async function shareText(text, url) {
  try {
    if (navigator.share) { await navigator.share({ text, url }); return "ok"; }
  } catch { return "cancel"; }
  return (await copyText(url ? `${text}\n${url}` : text)) ? "copied" : "fail";
}
export async function copyText(t) {
  try { await navigator.clipboard.writeText(t); return true; } catch { return false; }
}
