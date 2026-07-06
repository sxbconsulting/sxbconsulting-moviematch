// ============================================================
// BACKEND — Supabase (tables mm_sessions / mm_players / mm_shared_lists, déjà créées).
// Même interface qu'à l'étape 1 (localStorage) : les écrans n'ont pas eu à changer.
// Chaque appel réseau a un timeout de 4s (voir PROMPT_CLAUDE_CODE_MOVIEMATCH.md §9) ;
// en cas d'échec on renvoie null/false plutôt que de laisser l'UI bloquée
// (le mode hors-ligne complet sera peaufiné à l'étape 6).
// ============================================================
import { supabase } from "./supabase-client.js";
import { withTimeout } from "./utils.js";

async function run(promise) {
  try {
    const { data, error } = await withTimeout(promise, 4000);
    if (error) return { data: null, error };
    return { data, error: null };
  } catch (e) {
    return { data: null, error: e };
  }
}

export async function createSession(code, movies) {
  const { error } = await run(supabase.from("mm_sessions").insert({ code, movies }));
  return !error;
}

export async function getSession(code) {
  const { data } = await run(supabase.from("mm_sessions").select("*").eq("code", code).maybeSingle());
  return data || null;
}

export async function setWinner(code, movie) {
  const { error } = await run(supabase.from("mm_sessions").update({ winner: movie }).eq("code", code));
  return !error;
}

export async function getWinner(code) {
  const { data } = await run(supabase.from("mm_sessions").select("winner").eq("code", code).maybeSingle());
  return data?.winner || null;
}

export async function upsertPlayer(code, name, patch) {
  const row = { session_code: code, name, updated_at: new Date().toISOString(), ...patch };
  const { data } = await run(
    supabase.from("mm_players").upsert(row, { onConflict: "session_code,name" }).select().maybeSingle()
  );
  return data || row;
}

export async function getPlayer(code, name) {
  const { data } = await run(
    supabase.from("mm_players").select("*").eq("session_code", code).eq("name", name).maybeSingle()
  );
  return data || null;
}

export async function listPlayers(code) {
  const { data } = await run(supabase.from("mm_players").select("*").eq("session_code", code));
  return data || [];
}

export async function shareList(code, name, movies) {
  const { error } = await run(supabase.from("mm_shared_lists").insert({ code, name, movies }));
  return !error;
}

export async function getSharedList(code) {
  const { data } = await run(supabase.from("mm_shared_lists").select("*").eq("code", code).maybeSingle());
  return data || null;
}

// ————— Realtime : pousse les changements de mm_players / mm_sessions pour une salle —————
// Retourne une fonction de désabonnement. onStatus("SUBSCRIBED"|"CHANNEL_ERROR"|"TIMED_OUT"|...)
// permet à l'appelant de basculer sur le polling de secours si la connexion échoue.
export function subscribeToRoom(code, { onPlayersChange, onWinnerChange, onStatus }) {
  const channel = supabase
    .channel(`mm-room-${code}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "mm_players", filter: `session_code=eq.${code}` }, () => {
      onPlayersChange?.();
    })
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "mm_sessions", filter: `code=eq.${code}` }, (payload) => {
      onWinnerChange?.(payload.new?.winner || null);
    })
    .subscribe((status) => onStatus?.(status));

  return () => supabase.removeChannel(channel);
}
