// ============================================================
// BACKEND — Supabase (tables mm_sessions / mm_players / mm_shared_lists).
// Chaque appel réseau a un timeout de 4s ; en cas d'échec on renvoie null/false
// plutôt que de laisser l'UI bloquée.
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

// Création : renvoie "ok", "taken" (code déjà utilisé) ou "error" (Supabase injoignable).
export async function createSession(code, movies) {
  const { error } = await run(supabase.from("mm_sessions").insert({ code, movies }));
  if (!error) return "ok";
  return error.code === "23505" ? "taken" : "error";
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

// Colonnes ajoutées en v3.1 (seen = "déjà vu", device = identifiant d'appareil).
// Si le SQL de mise à jour n'a pas encore été lancé, on réessaie sans elles : l'app continue de marcher.
let extraColumns = true;
const EXTRA = ["seen", "device"];

export async function upsertPlayer(code, name, patch) {
  const row = { session_code: code, name, updated_at: new Date().toISOString(), ...patch };
  const send = (r) => run(supabase.from("mm_players").upsert(r, { onConflict: "session_code,name" }).select().maybeSingle());
  if (!extraColumns) EXTRA.forEach((k) => delete row[k]);
  let { data, error } = await send(row);
  if (error && extraColumns && EXTRA.some((k) => k in row) && /column|schema/i.test(String(error.message || error.code || ""))) {
    extraColumns = false;
    EXTRA.forEach((k) => delete row[k]);
    ({ data } = await send(row));
  }
  return data || row;
}

export async function getPlayer(code, name) {
  const { data } = await run(
    supabase.from("mm_players").select("*").eq("session_code", code).eq("name", name).maybeSingle()
  );
  return data || null;
}

// null = échec réseau (l'appelant garde l'ancienne liste plutôt que de la vider)
export async function listPlayers(code) {
  const { data, error } = await run(supabase.from("mm_players").select("*").eq("session_code", code));
  return error ? null : data || [];
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
