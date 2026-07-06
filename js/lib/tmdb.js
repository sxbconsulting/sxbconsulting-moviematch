// ============================================================
// Client TMDB — remplace le catalogue mocké de l'étape 1.
// Toutes les requêtes sont en français (fr-FR), avec un timeout de 4s
// (voir PROMPT_CLAUDE_CODE_MOVIEMATCH.md §9).
// ============================================================
import { TMDB_API_KEY, TMDB_LANG } from "../../config.js";
import { withTimeout } from "./utils.js";
import { GENRE_STYLE } from "../data/genre-style.js";

const API = "https://api.themoviedb.org/3";
const IMG_BASE = "https://image.tmdb.org/t/p/w500";
const YEAR_MIN = 1980, YEAR_MAX = 2026;

function buildUrl(path, params = {}) {
  const url = new URL(API + path);
  url.searchParams.set("api_key", TMDB_API_KEY);
  url.searchParams.set("language", TMDB_LANG);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url.toString();
}

async function getJSON(path, params) {
  const res = await withTimeout(fetch(buildUrl(path, params)), 4000);
  if (!res.ok) throw new Error("tmdb_http_" + res.status);
  return res.json();
}

export function posterUrl(path) {
  return path ? IMG_BASE + path : null;
}

// ————— Genres (mise en cache 24h, movie + tv ont des ids différents) —————
// On reprend nos 9 catégories du design (voir data/genre-style.js) et on les relie
// aux genres TMDB par mot-clé, pour que le dégradé de secours corresponde toujours.
const KEYWORD_TO_KEY = {
  "science-fiction": "Sci-Fi",
  "thriller": "Thriller",
  "mystère": "Thriller",
  "drame": "Drame",
  "guerre": "Drame",
  "histoire": "Drame",
  "action": "Action",
  "aventure": "Action",
  "comédie": "Comédie",
  "romance": "Romance",
  "horreur": "Horreur",
  "western": "Western",
  "animation": "Animation",
};

let genreCache = null; // { movie: [{id,name}], tv: [{id,name}] }

async function loadGenreCache() {
  if (genreCache) return genreCache;
  const cached = readCache("mm:tmdb:genres", 24 * 3600 * 1000);
  if (cached) { genreCache = cached; return cached; }
  const [movieRes, tvRes] = await Promise.all([
    getJSON("/genre/movie/list"),
    getJSON("/genre/tv/list"),
  ]);
  genreCache = { movie: movieRes.genres || [], tv: tvRes.genres || [] };
  writeCache("mm:tmdb:genres", genreCache);
  return genreCache;
}

function styleKeyForGenreIds(ids, mediaType, genres) {
  const list = mediaType === "tv" ? genres.tv : genres.movie;
  for (const id of ids || []) {
    const g = list.find((x) => x.id === id);
    if (!g) continue;
    const name = g.name.toLowerCase();
    for (const [kw, key] of Object.entries(KEYWORD_TO_KEY)) {
      if (name.includes(kw)) return key;
    }
  }
  return "Perso";
}

// Renvoie, pour chacune de nos 9 catégories, les ids TMDB correspondants (movie + tv).
export async function getGenreChips() {
  const genres = await loadGenreCache();
  const chips = {};
  for (const key of Object.keys(GENRE_STYLE)) {
    if (key === "Perso") continue;
    chips[key] = { movie: [], tv: [] };
  }
  for (const mediaType of ["movie", "tv"]) {
    for (const g of genres[mediaType]) {
      const name = g.name.toLowerCase();
      for (const [kw, key] of Object.entries(KEYWORD_TO_KEY)) {
        if (name.includes(kw) && chips[key]) { chips[key][mediaType].push(g.id); break; }
      }
    }
  }
  return chips;
}

// ————— Normalisation : un item TMDB → la forme attendue par les écrans —————
function normalize(raw, mediaType, genres) {
  const title = mediaType === "tv" ? (raw.name || raw.original_name) : (raw.title || raw.original_title);
  const dateStr = mediaType === "tv" ? raw.first_air_date : raw.release_date;
  const year = dateStr ? Number(dateStr.slice(0, 4)) : "";
  return {
    id: `${mediaType}-${raw.id}`,
    tmdb_id: raw.id,
    media_type: mediaType,
    title: title || "Sans titre",
    year,
    genre: styleKeyForGenreIds(raw.genre_ids, mediaType, genres),
    dur: "",
    pitch: (raw.overview || "").slice(0, 220),
    poster: posterUrl(raw.poster_path),
  };
}

function dedupe(items) {
  const seen = new Set();
  return items.filter((m) => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });
}

// ————— Cache local générique (localStorage + horodatage) —————
function readCache(key, maxAgeMs) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { at, data } = JSON.parse(raw);
    if (Date.now() - at > maxAgeMs) return null;
    return data;
  } catch { return null; }
}
function writeCache(key, data) {
  try { localStorage.setItem(key, JSON.stringify({ at: Date.now(), data })); } catch {}
}

// ————— Pool "🍿 Sélection" : mélange top_rated + discover 1980-2026, rafraîchi 1×/jour —————
export async function getPool() {
  const cached = readCache("mm:tmdb:pool", 24 * 3600 * 1000);
  if (cached && cached.length) return cached;

  const genres = await loadGenreCache();
  const calls = [
    getJSON("/movie/top_rated", { page: 1 }),
    getJSON("/movie/top_rated", { page: 2 }),
    getJSON("/tv/top_rated", { page: 1 }),
    getJSON("/tv/top_rated", { page: 2 }),
    getJSON("/discover/movie", { sort_by: "popularity.desc", "primary_release_date.gte": `${YEAR_MIN}-01-01`, "primary_release_date.lte": `${YEAR_MAX}-12-31`, page: 1 }),
    getJSON("/discover/tv", { sort_by: "popularity.desc", "first_air_date.gte": `${YEAR_MIN}-01-01`, "first_air_date.lte": `${YEAR_MAX}-12-31`, page: 1 }),
  ];
  const mediaTypes = ["movie", "movie", "tv", "tv", "movie", "tv"];
  const settled = await Promise.allSettled(calls);

  let items = [];
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") {
      items.push(...(r.value.results || []).map((raw) => normalize(raw, mediaTypes[i], genres)));
    }
  });
  items = dedupe(items).filter((m) => !m.year || (m.year >= YEAR_MIN && m.year <= YEAR_MAX));

  if (!items.length) throw new Error("tmdb_pool_empty");
  writeCache("mm:tmdb:pool", items);
  return items;
}

// ————— Découverte par genre(s), respecte le toggle Films/Séries/Les deux —————
export async function discoverByGenres(genreKeys, mediaMode) {
  const genres = await loadGenreCache();
  const chips = await getGenreChips();
  const movieIds = [...new Set(genreKeys.flatMap((k) => chips[k]?.movie || []))];
  const tvIds = [...new Set(genreKeys.flatMap((k) => chips[k]?.tv || []))];

  const calls = [];
  const mediaTypes = [];
  if ((mediaMode === "movie" || mediaMode === "both") && movieIds.length) {
    calls.push(getJSON("/discover/movie", { with_genres: movieIds.join(","), sort_by: "popularity.desc", page: 1 }));
    mediaTypes.push("movie");
    calls.push(getJSON("/discover/movie", { with_genres: movieIds.join(","), sort_by: "popularity.desc", page: 2 }));
    mediaTypes.push("movie");
  }
  if ((mediaMode === "tv" || mediaMode === "both") && tvIds.length) {
    calls.push(getJSON("/discover/tv", { with_genres: tvIds.join(","), sort_by: "popularity.desc", page: 1 }));
    mediaTypes.push("tv");
    calls.push(getJSON("/discover/tv", { with_genres: tvIds.join(","), sort_by: "popularity.desc", page: 2 }));
    mediaTypes.push("tv");
  }
  const settled = await Promise.allSettled(calls);
  let items = [];
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") items.push(...(r.value.results || []).map((raw) => normalize(raw, mediaTypes[i], genres)));
  });
  return dedupe(items);
}

// ————— Parcourir par genre + décennie (onglet "Catalogue" du constructeur de listes) —————
export async function browseCatalog({ genreKeys = [], decades = [], mediaMode = "both" } = {}) {
  const genres = await loadGenreCache();
  const chips = await getGenreChips();
  const movieIds = genreKeys.length ? [...new Set(genreKeys.flatMap((k) => chips[k]?.movie || []))] : [];
  const tvIds = genreKeys.length ? [...new Set(genreKeys.flatMap((k) => chips[k]?.tv || []))] : [];

  let gte, lte;
  if (decades.length) {
    const sorted = [...decades].sort((a, b) => a - b);
    gte = `${sorted[0]}-01-01`;
    lte = `${sorted[sorted.length - 1] + 9}-12-31`;
  }

  const calls = [], mediaTypes = [];
  if (mediaMode === "movie" || mediaMode === "both") {
    const params = { sort_by: "popularity.desc", page: 1 };
    if (movieIds.length) params.with_genres = movieIds.join(",");
    if (gte) { params["primary_release_date.gte"] = gte; params["primary_release_date.lte"] = lte; }
    calls.push(getJSON("/discover/movie", params)); mediaTypes.push("movie");
  }
  if (mediaMode === "tv" || mediaMode === "both") {
    const params = { sort_by: "popularity.desc", page: 1 };
    if (tvIds.length) params.with_genres = tvIds.join(",");
    if (gte) { params["first_air_date.gte"] = gte; params["first_air_date.lte"] = lte; }
    calls.push(getJSON("/discover/tv", params)); mediaTypes.push("tv");
  }
  const settled = await Promise.allSettled(calls);
  let items = [];
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") items.push(...(r.value.results || []).map((raw) => normalize(raw, mediaTypes[i], genres)));
  });
  return dedupe(items);
}

// ————— Recherche (autocomplete liste perso / builder), films + séries confondus —————
export async function searchMulti(query) {
  if (!query || query.trim().length < 2) return [];
  const genres = await loadGenreCache();
  const data = await getJSON("/search/multi", { query: query.trim(), page: 1, include_adult: "false" });
  return (data.results || [])
    .filter((r) => r.media_type === "movie" || r.media_type === "tv")
    .slice(0, 10)
    .map((raw) => normalize(raw, raw.media_type, genres));
}

// ————— Réconciliation : titres proposés par Claude ({title,year,genre}) → vraies fiches TMDB —————
// Cherche chaque titre sur TMDB pour récupérer affiche/id ; si introuvable, on garde quand même
// le titre proposé sous forme de carte "Perso" (pas de blocage total sur une suggestion IA).
export async function reconcileTitles(items, pitch = "Suggestion IA 🤖") {
  const out = [];
  for (const item of (items || []).slice(0, 30)) {
    const title = String(item.title || "").trim();
    if (!title) continue;
    try {
      const matches = await searchMulti(title);
      const best = matches.find((m) => !item.year || Math.abs((m.year || 0) - item.year) <= 1) || matches[0];
      if (best) { out.push(best); continue; }
    } catch { /* on retombe sur la carte Perso ci-dessous */ }
    out.push({
      id: "ia" + Date.now() + Math.random().toString(36).slice(2, 7),
      title: title.slice(0, 60),
      year: item.year || "",
      genre: GENRE_STYLE[item.genre] ? item.genre : "Perso",
      dur: "", pitch,
    });
  }
  return out;
}

// ————— "Films avec tel acteur/réalisateur" — TMDB nativement, sans passer par Claude —————
export async function searchPersonCredits(name) {
  const data = await getJSON("/search/person", { query: name, page: 1 });
  const person = (data.results || [])[0];
  if (!person) return null;
  const genres = await loadGenreCache();
  const credits = await getJSON(`/person/${person.id}/combined_credits`);
  const items = (credits.cast || [])
    .filter((c) => c.media_type === "movie" || c.media_type === "tv")
    // Exclut les apparitions "en tant que soi-même" (talk-shows, cérémonies…) qui polluent
    // sinon la filmographie avec des passages télé plutôt que de vrais rôles.
    .filter((c) => !/\bself\b/i.test(c.character || ""))
    .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
    .slice(0, 20)
    .map((raw) => normalize(raw, raw.media_type, genres));
  return { personName: person.name, items: dedupe(items) };
}

// ————— Fiche détaillée (film ou série) + casting —————
function formatDuration(minutes) {
  if (!minutes) return "";
  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, "0")}`;
}

export async function getDetails(mediaType, tmdbId) {
  const cacheKey = `mm:tmdb:details:${mediaType}-${tmdbId}`;
  const cached = readCache(cacheKey, 7 * 24 * 3600 * 1000);
  if (cached) return cached;

  const path = mediaType === "tv" ? `/tv/${tmdbId}` : `/movie/${tmdbId}`;
  const data = await getJSON(path, { append_to_response: "credits" });

  const director = mediaType === "tv"
    ? (data.created_by || []).map((c) => c.name).join(", ")
    : (data.credits?.crew || []).find((c) => c.job === "Director")?.name || "";

  const duree = mediaType === "tv"
    ? `${data.number_of_seasons || "?"} saison${data.number_of_seasons > 1 ? "s" : ""} · ${data.number_of_episodes || "?"} épisodes`
    : formatDuration(data.runtime);

  const details = {
    realisateur: director,
    casting: (data.credits?.cast || []).slice(0, 6).map((c) => c.name),
    synopsis: data.overview || "",
    note: data.vote_average ? (data.vote_average / 2).toFixed(1) : "",
    annee: (mediaType === "tv" ? data.first_air_date : data.release_date || "").slice(0, 4),
    duree,
    poster: posterUrl(data.poster_path),
    isTv: mediaType === "tv",
  };
  writeCache(cacheKey, details);
  return details;
}
