-- ============================================================
-- HABBO SOLO — T1: esquema de Supabase (Fase 1)
--
-- Crea las 3 tablas del diseño, activa RLS, define las policies
-- y el trigger que provisiona a cada usuario nuevo.
--
-- Frontera publico/privado (clave para la Fase 2 de Presence):
--   profiles  -> lectura publica (nombre + aspecto del avatar)
--   salas     -> lectura publica (salas + decorado visitables),
--                escritura solo del dueno
--   partidas  -> privada total (creditos, inventario, progreso)
--
-- Restricciones respetadas:
--   - Sin service_role: todo funciona con la anon key + RLS.
--   - Los visitantes SOLO leen profiles y salas; nunca modifican.
--   - Las partidas son privadas (solo el dueno lee/escribe).
--   - No se crean tablas de Fase 2 (Presence/chat son canales
--     de Realtime, efimeros, no necesitan tablas).
--
-- Idempotente: seguro de re-ejecutar en el SQL Editor.
-- Pegar entero y ejecutar.
-- ============================================================

-- ------------------------------------------------------------
-- 0. Utilidad: mantener updated_at al dia
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- 1. TABLAS
-- ============================================================

-- ---- profiles (1:1 con auth.users, lectura publica) --------
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text not null default '',
  avatar        jsonb not null default '{}'::jsonb,  -- estado.avatar (aspecto voxel)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---- partidas (1:1 con usuario, PRIVADA total) -------------
-- estado_privado = todo lo que NO es visible para otros jugadores:
-- creditos, sigUid, inventario, comida, recompensas, tareas,
-- minijuegos, casino, mascotas, ambiente, salaActual.
create table if not exists public.partidas (
  user_id         uuid primary key references auth.users (id) on delete cascade,
  version         int not null default 1,
  estado_privado  jsonb not null default '{}'::jsonb,
  updated_at      timestamptz not null default now()
);

-- ---- salas (1:N por usuario, lectura publica, escritura dueno)
-- 'indice' preserva el ORDEN de las salas: los NPC fijos dependen
-- del indice de sala (baile va antes que casino). Cargar siempre
-- ORDER BY indice.
-- 'furnis' es el array de muebles colocados (JSONB), guardado de
-- forma atomica por sala: [{uid,id,x,y,rot} | {uid,id,pared,slot,fijo?}]
create table if not exists public.salas (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  indice        int not null,
  nombre        text not null default '',
  ancho         int not null,
  fondo         int not null,
  tipo          text,                                  -- jardin|baile|casino|null
  color_suelo   text not null,
  color_pared   text not null,
  desbloqueada  boolean not null default false,
  precio        int not null default 0,
  furnis        jsonb not null default '[]'::jsonb,
  updated_at    timestamptz not null default now(),
  unique (user_id, indice)
);

create index if not exists salas_user_id_idx on public.salas (user_id);

-- ---- triggers de updated_at --------------------------------
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists partidas_set_updated_at on public.partidas;
create trigger partidas_set_updated_at
  before update on public.partidas
  for each row execute function public.set_updated_at();

drop trigger if exists salas_set_updated_at on public.salas;
create trigger salas_set_updated_at
  before update on public.salas
  for each row execute function public.set_updated_at();

-- ============================================================
-- 2. GRANTS (solo 'authenticated'; 'anon' no tiene acceso)
--    RLS filtra por FILA; los GRANT dan el privilegio base que
--    PostgREST necesita. Para visitar hay que tener cuenta.
-- ============================================================
grant usage on schema public to authenticated;

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.partidas to authenticated;
grant select, insert, update, delete on public.salas    to authenticated;

-- Aseguramos que el rol anonimo no pueda tocar nada.
revoke all on public.profiles from anon;
revoke all on public.partidas from anon;
revoke all on public.salas    from anon;

-- ============================================================
-- 3. RLS: activar (denegar por defecto) + policies
-- ============================================================
alter table public.profiles enable row level security;
alter table public.partidas enable row level security;
alter table public.salas    enable row level security;

-- ---- profiles: lectura publica, escritura solo del dueno ----
drop policy if exists profiles_select_all on public.profiles;
create policy profiles_select_all
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);
-- (sin policy de DELETE: solo cae en cascada al borrar el usuario)

-- ---- partidas: PRIVADA total (solo el dueno, todo) ----------
drop policy if exists partidas_owner_all on public.partidas;
create policy partidas_owner_all
  on public.partidas for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---- salas: lectura publica, escritura solo del dueno -------
drop policy if exists salas_select_all on public.salas;
create policy salas_select_all
  on public.salas for select
  to authenticated
  using (true);

drop policy if exists salas_insert_own on public.salas;
create policy salas_insert_own
  on public.salas for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists salas_update_own on public.salas;
create policy salas_update_own
  on public.salas for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists salas_delete_own on public.salas;
create policy salas_delete_own
  on public.salas for delete
  to authenticated
  using (auth.uid() = user_id);

-- ============================================================
-- 4. TRIGGER handle_new_user
--    Provisiona a cada usuario nuevo: crea su profile y su
--    partida con los valores por defecto del juego. Corre como
--    SECURITY DEFINER DENTRO de Postgres (no es service_role en
--    el frontend), por eso puede insertar saltandose RLS.
--
--    NOTA: no siembra las SALAS aqui a proposito. El decorado
--    inicial (~30 furnis por sala) vive en Juego.nuevaPartida();
--    duplicarlo en SQL invitaria a que ambos se desincronicen.
--    El cliente sembrara las salas desde nuevaPartida() en la
--    primera carga, y Juego.migrar() garantiza los furnis fijos
--    (ordenador, jardin, baile, casino). estado_privado tambien
--    queda cubierto por migrar() si algun campo falta.
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    jsonb_build_object(
      'peinado',  'clasico',
      'pelo',     'madera_oscura',
      'piel',     'piel',
      'camiseta', 'turquesa',
      'pantalon', 'gris_oscuro',
      'zapatos',  'negro'
    )
  )
  on conflict (id) do nothing;

  insert into public.partidas (user_id, version, estado_privado)
  values (
    new.id,
    1,
    jsonb_build_object(
      'creditos',    1100000,
      'sigUid',      100,
      'inventario',  '[]'::jsonb,
      'salaActual',  0,
      'mascotas',    '[]'::jsonb,
      'comida',      jsonb_build_object('perro', 0, 'gato', 0, 'pez', 0, 'pajaro', 0),
      'recompensas', jsonb_build_object('fuente', false, 'gnomo', false, 'bola_disco', false, 'bailar', false),
      'tareas',      jsonb_build_object('fecha', '', 'progreso', '{}'::jsonb, 'reclamadas', '{}'::jsonb, 'juegosHoy', '[]'::jsonb, 'npcsHoy', '[]'::jsonb),
      'minijuegos',  '{}'::jsonb,
      'casino',      jsonb_build_object('jugadas', 0, 'apostado', 0, 'ganado', 0),
      'ambiente',    'auto'
    )
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- FIN T1
-- ============================================================
