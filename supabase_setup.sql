-- ============================================================
-- MovieMatch — schéma Supabase
-- Idempotent : peut être recollé sans risque dans le SQL Editor,
-- même si les tables/policies/Realtime existent déjà.
-- ============================================================

-- ————— Salles de swipe —————
create table if not exists mm_sessions (
  code text primary key,            -- 5 lettres (sans I, L, O) ; anciennes salles : 4 lettres
  movies jsonb not null,             -- deck figé à la création [{id,title,year,genre,dur,pitch,poster,tmdb_id,media_type}]
  winner jsonb,                      -- film gagnant du VS (null tant que pas de VS)
  created_at timestamptz default now()
);

-- Limite de taille du deck (évite un abus d'écriture via l'API publique).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'mm_sessions_movies_size_check'
  ) then
    alter table mm_sessions
      add constraint mm_sessions_movies_size_check check (jsonb_array_length(movies) <= 50);
  end if;
end $$;

-- Les salles expirent au bout de 7 jours côté app (on ne peut plus les rejoindre).
-- Nettoyage optionnel des vieilles lignes (à lancer à la main de temps en temps) :
-- delete from mm_sessions where created_at < now() - interval '7 days';

-- ————— Joueurs d'une salle —————
create table if not exists mm_players (
  session_code text references mm_sessions(code) on delete cascade,
  name text not null,
  votes jsonb default '{}',          -- {movieId: true/false}
  done boolean default false,
  updated_at timestamptz default now(),
  primary key (session_code, name)
);

-- v3.1 : "déjà vu" (ids des titres marqués vus par ce joueur) + identifiant d'appareil
-- (empêche deux personnes d'utiliser le même prénom dans une salle et d'écraser leurs votes).
-- L'app fonctionne sans ces colonnes (elle les ignore), mais ces deux fonctions ont besoin d'elles.
alter table mm_players add column if not exists seen jsonb default '[]'::jsonb;
alter table mm_players add column if not exists device text;

-- ————— Listes partagées par code —————
create table if not exists mm_shared_lists (
  code text primary key,             -- 5 lettres (anciennes listes : 4)
  name text not null,
  movies jsonb not null,
  created_at timestamptz default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'mm_shared_lists_movies_size_check'
  ) then
    alter table mm_shared_lists
      add constraint mm_shared_lists_movies_size_check check (jsonb_array_length(movies) <= 50);
  end if;
end $$;

-- ————— RLS : app sans compte, le code à 5 lettres (+ expiration 7 jours) fait office de secret —————
alter table mm_sessions enable row level security;
alter table mm_players enable row level security;
alter table mm_shared_lists enable row level security;

drop policy if exists "mm_sessions_public_insert" on mm_sessions;
create policy "mm_sessions_public_insert" on mm_sessions for insert to anon, authenticated with check (true);

drop policy if exists "mm_sessions_public_select" on mm_sessions;
create policy "mm_sessions_public_select" on mm_sessions for select to anon, authenticated using (true);

drop policy if exists "mm_sessions_public_update" on mm_sessions;
create policy "mm_sessions_public_update" on mm_sessions for update to anon, authenticated using (true) with check (true);

drop policy if exists "mm_players_public_insert" on mm_players;
create policy "mm_players_public_insert" on mm_players for insert to anon, authenticated with check (true);

drop policy if exists "mm_players_public_select" on mm_players;
create policy "mm_players_public_select" on mm_players for select to anon, authenticated using (true);

drop policy if exists "mm_players_public_update" on mm_players;
create policy "mm_players_public_update" on mm_players for update to anon, authenticated using (true) with check (true);

drop policy if exists "mm_shared_lists_public_insert" on mm_shared_lists;
create policy "mm_shared_lists_public_insert" on mm_shared_lists for insert to anon, authenticated with check (true);

drop policy if exists "mm_shared_lists_public_select" on mm_shared_lists;
create policy "mm_shared_lists_public_select" on mm_shared_lists for select to anon, authenticated using (true);

-- ————— Realtime : pousse les changements de mm_sessions/mm_players aux clients abonnés —————
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'mm_sessions'
  ) then
    alter publication supabase_realtime add table mm_sessions;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'mm_players'
  ) then
    alter publication supabase_realtime add table mm_players;
  end if;
end $$;
