// Configuration client — clés utilisables côté navigateur (lecture seule, ou protégées par RLS côté Supabase).
// Ne JAMAIS mettre ici la clé secrète Anthropic : elle reste uniquement dans les secrets
// de l'Edge Function (voir supabase/functions/claude-proxy), jamais dans ce fichier public.
export const TMDB_API_KEY = "a96a1eef624b47a957cfe2ef6aced144";
export const TMDB_LANG = "fr-FR";

// Projet Supabase "moviematch" — la Publishable key est faite pour être utilisée côté client
// (équivalent moderne de l'ancienne clé anon), la RLS protège les données côté serveur.
export const SUPABASE_URL = "https://wjbdineoanzblgsmgmwi.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_n-nOxEpo780E5nJ2hvScww__M3N9lgV";
