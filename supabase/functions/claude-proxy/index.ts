// Edge Function "claude-proxy" — la clé Anthropic ne vit QUE côté serveur ici
// (secret ANTHROPIC_API_KEY défini via le tableau de bord Supabase ou `supabase secrets set`).
// Reçoit { type: "images" | "link" | "suggest" | "fiche", payload } et renvoie du JSON.
//
// verify_jwt est désactivé : ce projet utilise les nouvelles "Publishable keys" (sb_publishable_...),
// qui ne sont pas des JWT et échoueraient donc la vérification. La protection vient à la place
// d'une validation stricte du payload (type whitelisté, tailles plafonnées) — cohérent avec une
// app sans compte où les codes de salle à 4 lettres font déjà office de secret faible.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 1200;
const MAX_PAYLOAD_BYTES = 8_000_000; // ~8 Mo, large pour 5 photos en base64

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FILM_JSON_RULES =
  'Réponds UNIQUEMENT avec un tableau JSON valide, sans aucun texte autour ni backticks, au format : ' +
  '[{"title":"Titre","year":2020,"genre":"Genre"}]. Films ET séries acceptés. Le champ genre doit être ' +
  "EXACTEMENT l'un de : Sci-Fi, Thriller, Drame, Action, Comédie, Romance, Horreur, Western, Animation — " +
  "ou Perso si incertain. Titres en français si connus. Maximum 30 titres, sans doublons.";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function parseFilmArray(text: string) {
  const clean = text.replace(/```json|```/g, "").trim();
  const start = clean.indexOf("[");
  const end = clean.lastIndexOf("]");
  if (start === -1 || end === -1) throw new Error("format");
  const arr = JSON.parse(clean.slice(start, end + 1));
  if (!Array.isArray(arr)) throw new Error("format");
  return arr.slice(0, 30);
}

async function callClaude(content: unknown, useSearch: boolean) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY ?? "",
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content }],
      ...(useSearch ? { tools: [{ type: "web_search_20250305", name: "web_search" }] } : {}),
    }),
  });
  if (!res.ok) throw new Error(`anthropic_${res.status}`);
  const data = await res.json();
  return (data.content || [])
    .filter((b: { type: string }) => b.type === "text")
    .map((b: { text: string }) => b.text)
    .join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);
  if (!ANTHROPIC_API_KEY) return jsonResponse({ error: "server_misconfigured" }, 500);

  const raw = await req.text();
  if (raw.length > MAX_PAYLOAD_BYTES) return jsonResponse({ error: "payload_too_large" }, 413);

  let body: { type?: string; payload?: Record<string, unknown> };
  try {
    body = JSON.parse(raw);
  } catch {
    return jsonResponse({ error: "bad_json" }, 400);
  }

  const { type, payload } = body || {};
  if (!type || !["images", "link", "suggest", "fiche"].includes(type)) {
    return jsonResponse({ error: "invalid_type" }, 400);
  }

  try {
    if (type === "link") {
      const url = String(payload?.url || "").slice(0, 500);
      if (!/^https?:\/\/.+\..+/.test(url)) return jsonResponse({ error: "invalid_url" }, 400);
      const text = await callClaude(
        `Consulte cette page web et liste tous les films et séries qui y sont mentionnés (top, liste, article, sélection) : ${url}\n\n${FILM_JSON_RULES}`,
        true
      );
      return jsonResponse({ films: parseFilmArray(text) });
    }

    if (type === "suggest") {
      const query = String(payload?.query || "").slice(0, 200);
      if (!query) return jsonResponse({ error: "empty_query" }, 400);
      const text = await callClaude(
        `Propose une liste de films ou séries réels et connus correspondant à cette demande : "${query}". ` +
          "La demande peut être un acteur, un réalisateur, une année ou décennie, un thème, une ambiance, ou " +
          `"des films/séries comme X". Ne propose que des titres qui existent vraiment. ${FILM_JSON_RULES}`,
        true
      );
      return jsonResponse({ films: parseFilmArray(text) });
    }

    if (type === "images") {
      const images = Array.isArray(payload?.images) ? payload.images.slice(0, 5) : [];
      if (!images.length) return jsonResponse({ error: "no_images" }, 400);
      const content = [
        ...images.map((img: { media_type: string; data: string }) => ({
          type: "image",
          source: { type: "base64", media_type: img.media_type, data: img.data },
        })),
        {
          type: "text",
          text: `Liste tous les films et séries visibles sur ces images (affiches, captures de catalogue streaming, listes, articles). ${FILM_JSON_RULES}`,
        },
      ];
      const text = await callClaude(content, false);
      return jsonResponse({ films: parseFilmArray(text) });
    }

    if (type === "fiche") {
      const title = String(payload?.title || "").slice(0, 120);
      const year = payload?.year ? Number(payload.year) : null;
      if (!title) return jsonResponse({ error: "empty_title" }, 400);
      const text = await callClaude(
        `Cherche les informations sur le film ou la série "${title}"${year ? ` (${year})` : ""} et réponds ` +
          'UNIQUEMENT avec un objet JSON valide, sans texte autour ni backticks : {"realisateur":"nom",' +
          '"casting":["acteur 1","acteur 2","acteur 3","acteur 4"],"synopsis":"résumé de l\'intrigue ' +
          'entièrement reformulé avec tes propres mots, 2 à 3 phrases","note":"note moyenne sur 5, ex : 4.2",' +
          '"annee":2020,"duree":"2h10"}. Si le film est introuvable, réponds {"introuvable":true}.',
        true
      );
      const clean = text.replace(/```json|```/g, "").trim();
      const s = clean.indexOf("{");
      const e = clean.lastIndexOf("}");
      if (s === -1 || e === -1) throw new Error("format");
      const obj = JSON.parse(clean.slice(s, e + 1));
      if (obj.introuvable) return jsonResponse({ error: "introuvable" }, 404);
      return jsonResponse({ fiche: obj });
    }

    return jsonResponse({ error: "invalid_type" }, 400);
  } catch (e) {
    return jsonResponse({ error: "claude_failed", detail: String((e as Error)?.message || e) }, 502);
  }
});
