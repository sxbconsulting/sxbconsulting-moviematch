// Appelle l'Edge Function "claude-proxy" (voir supabase/functions/claude-proxy/index.ts).
// Claude + recherche web peut prendre plusieurs secondes : on utilise un timeout plus large
// que les 4s habituelles (réservées aux appels TMDB/Supabase, bien plus rapides).
import { SUPABASE_URL } from "../../config.js";
import { withTimeout } from "./utils.js";

const ENDPOINT = `${SUPABASE_URL}/functions/v1/claude-proxy`;
const AI_TIMEOUT_MS = 20000;

async function callProxy(type, payload) {
  const res = await withTimeout(
    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, payload }),
    }),
    AI_TIMEOUT_MS
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "proxy_error");
  return data;
}

export async function extractFilmsFromLink(url) {
  const { films } = await callProxy("link", { url });
  return films || [];
}

export async function extractFilmsFromImages(images) {
  const { films } = await callProxy("images", { images });
  return films || [];
}

export async function suggestFilms(query) {
  const { films } = await callProxy("suggest", { query });
  return films || [];
}

export async function ficheViaClaude(title, year) {
  const { fiche } = await callProxy("fiche", { title, year });
  return fiche;
}
