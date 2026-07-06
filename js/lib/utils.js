// Petites fonctions partagées par plusieurs écrans.

export const cleanName = (s) => s.trim().replace(/[\s/\\'"]+/g, "-").slice(0, 20);

export const randCode = () =>
  Array.from({ length: 4 }, () => "ABCDEFGHJKMNPQRSTUVWXYZ"[Math.floor(Math.random() * 23)]).join("");

export function parsePastedLines(text, max = 40) {
  return text
    .split(/\n/)
    .map((s) => s.replace(/^[\s\d.)\-•·*]+/, "").trim())
    .filter((s) => s.length > 1)
    .slice(0, max);
}

export const DECK_SIZE = 20;

export function pickRandom(arr, n) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

// Timeout réseau (4 s par défaut, voir PROMPT_CLAUDE_CODE_MOVIEMATCH.md §9) — utilisé par
// les appels TMDB (et plus tard Supabase/Edge Function) pour ne jamais bloquer l'UI.
export function withTimeout(promise, ms = 4000) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout")), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
