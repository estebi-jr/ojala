-- =====================================================================
-- Ojalá · base de datos para Supabase
-- Cómo usarlo: Supabase → SQL Editor → New query → pega TODO → Run.
-- Se puede correr más de una vez sin romper nada.
--
-- Seguridad, en simple:
--  * Nadie puede leer ni escribir las tablas directamente (RLS sin políticas).
--  * Todo pasa por las funciones de abajo, que revisan el "token" de edición.
--  * Los tokens se guardan "hasheados" (sha256) en un esquema privado.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;

-- ---------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------
create table if not exists public.lists (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  title       text not null check (char_length(title) between 1 and 120),
  owner_name  text check (char_length(owner_name) <= 60),
  occasion    text not null default 'otra' check (char_length(occasion) <= 20),
  event_date  date,
  message     text check (char_length(message) <= 1500),
  cover       text check (octet_length(cover) <= 600000),
  avatar      text check (octet_length(avatar) <= 200000),
  surprise    boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.items (
  id          uuid primary key default gen_random_uuid(),
  list_id     uuid not null references public.lists(id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 200),
  url         text check (char_length(url) <= 2000),
  image       text check (octet_length(image) <= 400000),
  price       numeric(14, 2) check (price >= 0),
  currency    text not null default 'CLP' check (char_length(currency) = 3),
  store       text check (char_length(store) <= 120),
  note        text check (char_length(note) <= 1000),
  emoji       text check (char_length(emoji) <= 16),
  priority    boolean not null default false,
  qty         integer not null default 1 check (qty between 1 and 99),
  position    integer not null default 0,
  hidden      boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists items_list_idx on public.items (list_id, position);

create table if not exists public.claims (
  id          uuid primary key default gen_random_uuid(),
  item_id     uuid not null references public.items(id) on delete cascade,
  name        text check (char_length(name) <= 60),
  qty         integer not null default 1 check (qty between 1 and 99),
  created_at  timestamptz not null default now()
);
create index if not exists claims_item_idx on public.claims (item_id);

-- Llaves (hash de los tokens), fuera del alcance de la API
create table if not exists private.list_keys (
  list_id     uuid primary key references public.lists(id) on delete cascade,
  token_hash  bytea not null
);
create table if not exists private.claim_keys (
  claim_id    uuid primary key references public.claims(id) on delete cascade,
  token_hash  bytea not null
);

-- RLS activado y SIN políticas: la API no puede tocar las tablas directo
alter table public.lists  enable row level security;
alter table public.items  enable row level security;
alter table public.claims enable row level security;
alter table private.list_keys  enable row level security;
alter table private.claim_keys enable row level security;
revoke all on public.lists, public.items, public.claims from anon, authenticated;
revoke all on schema private from anon, authenticated;

-- ---------------------------------------------------------------------
-- Ayudantes privados
-- ---------------------------------------------------------------------
create or replace function private.new_token() returns text
language sql volatile set search_path = '' as $$
  select translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_')
$$;

create or replace function private.hash(p_token text) returns bytea
language sql immutable set search_path = '' as $$
  select extensions.digest(coalesce(p_token, ''), 'sha256')
$$;

create or replace function private.new_slug() returns text
language plpgsql volatile set search_path = '' as $$
declare
  alphabet constant text := 'abcdefghjkmnpqrstuvwxyz23456789';
  b bytea;
  s text;
begin
  loop
    b := extensions.gen_random_bytes(9);
    s := '';
    for i in 0..8 loop
      s := s || substr(alphabet, (get_byte(b, i) % length(alphabet)) + 1, 1);
    end loop;
    exit when not exists (select 1 from public.lists l where l.slug = s);
  end loop;
  return s;
end $$;

create or replace function private.assert_owner(p_list_id uuid, p_token text) returns void
language plpgsql stable set search_path = '' as $$
begin
  if not exists (select 1 from public.lists l where l.id = p_list_id) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if p_token is null or not exists (
    select 1 from private.list_keys k where k.list_id = p_list_id and k.token_hash = private.hash(p_token)
  ) then
    raise exception 'invalid_token' using errcode = 'P0001';
  end if;
end $$;

create or replace function private.claim_json(c public.claims) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object('id', c.id, 'item_id', c.item_id, 'name', c.name, 'qty', c.qty, 'created_at', c.created_at)
$$;

-- ---------------------------------------------------------------------
-- API pública (la usa la app con la llave pública)
-- ---------------------------------------------------------------------

-- Crear lista → devuelve la lista y su token de edición (solo esta vez)
create or replace function public.create_list(p_data jsonb)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  v_token text := private.new_token();
  v_list public.lists;
begin
  insert into public.lists (slug, title, owner_name, occasion, event_date, message, cover, avatar, surprise)
  values (
    private.new_slug(),
    coalesce(nullif(btrim(p_data->>'title'), ''), 'Mi lista de deseos'),
    nullif(btrim(p_data->>'owner_name'), ''),
    coalesce(nullif(p_data->>'occasion', ''), 'otra'),
    nullif(p_data->>'event_date', '')::date,
    nullif(p_data->>'message', ''),
    nullif(p_data->>'cover', ''),
    nullif(p_data->>'avatar', ''),
    coalesce((p_data->>'surprise')::boolean, true)
  )
  returning * into v_list;
  insert into private.list_keys (list_id, token_hash) values (v_list.id, private.hash(v_token));
  return jsonb_build_object('list', to_jsonb(v_list), 'token', v_token);
end $$;

-- Leer una lista por su enlace. Con token válido trae también lo oculto.
create or replace function public.get_list(p_slug text, p_token text default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_list public.lists;
  v_owner boolean := false;
begin
  select * into v_list from public.lists where slug = lower(btrim(p_slug));
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if p_token is not null then
    v_owner := exists (select 1 from private.list_keys k where k.list_id = v_list.id and k.token_hash = private.hash(p_token));
  end if;
  return jsonb_build_object(
    'list', to_jsonb(v_list),
    'is_owner', v_owner,
    'items', coalesce((
      select jsonb_agg(to_jsonb(i) order by i.position, i.created_at)
      from public.items i where i.list_id = v_list.id and (v_owner or not i.hidden)
    ), '[]'::jsonb),
    'claims', coalesce((
      select jsonb_agg(private.claim_json(c) order by c.created_at)
      from public.claims c join public.items i on i.id = c.item_id
      where i.list_id = v_list.id and (v_owner or not i.hidden)
    ), '[]'::jsonb)
  );
end $$;

-- Verificar un enlace de edición (para abrirlo en otro dispositivo)
create or replace function public.check_token(p_slug text, p_token text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_list public.lists;
begin
  select * into v_list from public.lists where slug = lower(btrim(p_slug));
  if not found or not exists (
    select 1 from private.list_keys k where k.list_id = v_list.id and k.token_hash = private.hash(p_token)
  ) then
    raise exception 'invalid_token' using errcode = 'P0001';
  end if;
  return jsonb_build_object('ok', true, 'list', to_jsonb(v_list));
end $$;

-- Editar datos de la lista (solo los campos que vienen en p_data)
create or replace function public.update_list(p_list_id uuid, p_token text, p_data jsonb)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  v_list public.lists;
begin
  perform private.assert_owner(p_list_id, p_token);
  update public.lists l set
    title      = case when p_data ? 'title' then coalesce(nullif(btrim(p_data->>'title'), ''), l.title) else l.title end,
    owner_name = case when p_data ? 'owner_name' then nullif(btrim(p_data->>'owner_name'), '') else l.owner_name end,
    occasion   = case when p_data ? 'occasion' then coalesce(nullif(p_data->>'occasion', ''), l.occasion) else l.occasion end,
    event_date = case when p_data ? 'event_date' then nullif(p_data->>'event_date', '')::date else l.event_date end,
    message    = case when p_data ? 'message' then nullif(p_data->>'message', '') else l.message end,
    cover      = case when p_data ? 'cover' then nullif(p_data->>'cover', '') else l.cover end,
    avatar     = case when p_data ? 'avatar' then nullif(p_data->>'avatar', '') else l.avatar end,
    surprise   = case when p_data ? 'surprise' then coalesce((p_data->>'surprise')::boolean, l.surprise) else l.surprise end,
    updated_at = now()
  where l.id = p_list_id
  returning * into v_list;
  return to_jsonb(v_list);
end $$;

create or replace function public.delete_list(p_list_id uuid, p_token text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
begin
  perform private.assert_owner(p_list_id, p_token);
  delete from public.lists where id = p_list_id;
  return jsonb_build_object('ok', true);
end $$;

-- Crear o editar un deseo. Sin "id" = nuevo (queda primero en la lista).
create or replace function public.save_item(p_list_id uuid, p_token text, p_item jsonb)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  v_id uuid := nullif(p_item->>'id', '')::uuid;
  v_item public.items;
  v_pos integer;
begin
  perform private.assert_owner(p_list_id, p_token);
  if v_id is null then
    if (select count(*) from public.items where list_id = p_list_id) >= 300 then
      raise exception 'too_many_items' using errcode = 'P0001';
    end if;
    select coalesce(min(position), 0) - 1 into v_pos from public.items where list_id = p_list_id;
    insert into public.items (list_id, title, url, image, price, currency, store, note, emoji, priority, qty, position, hidden)
    values (
      p_list_id,
      coalesce(nullif(btrim(p_item->>'title'), ''), 'Deseo'),
      nullif(p_item->>'url', ''),
      nullif(p_item->>'image', ''),
      nullif(p_item->>'price', '')::numeric,
      coalesce(nullif(p_item->>'currency', ''), 'CLP'),
      nullif(p_item->>'store', ''),
      nullif(p_item->>'note', ''),
      nullif(p_item->>'emoji', ''),
      coalesce((p_item->>'priority')::boolean, false),
      coalesce((p_item->>'qty')::integer, 1),
      coalesce((p_item->>'position')::integer, v_pos),
      coalesce((p_item->>'hidden')::boolean, false)
    )
    returning * into v_item;
  else
    update public.items i set
      title    = case when p_item ? 'title' then coalesce(nullif(btrim(p_item->>'title'), ''), i.title) else i.title end,
      url      = case when p_item ? 'url' then nullif(p_item->>'url', '') else i.url end,
      image    = case when p_item ? 'image' then nullif(p_item->>'image', '') else i.image end,
      price    = case when p_item ? 'price' then nullif(p_item->>'price', '')::numeric else i.price end,
      currency = case when p_item ? 'currency' then coalesce(nullif(p_item->>'currency', ''), i.currency) else i.currency end,
      store    = case when p_item ? 'store' then nullif(p_item->>'store', '') else i.store end,
      note     = case when p_item ? 'note' then nullif(p_item->>'note', '') else i.note end,
      emoji    = case when p_item ? 'emoji' then nullif(p_item->>'emoji', '') else i.emoji end,
      priority = case when p_item ? 'priority' then coalesce((p_item->>'priority')::boolean, i.priority) else i.priority end,
      qty      = case when p_item ? 'qty' then coalesce((p_item->>'qty')::integer, i.qty) else i.qty end,
      position = case when p_item ? 'position' then coalesce((p_item->>'position')::integer, i.position) else i.position end,
      hidden   = case when p_item ? 'hidden' then coalesce((p_item->>'hidden')::boolean, i.hidden) else i.hidden end,
      updated_at = now()
    where i.id = v_id and i.list_id = p_list_id
    returning * into v_item;
    if not found then
      raise exception 'not_found' using errcode = 'P0001';
    end if;
  end if;
  return to_jsonb(v_item);
end $$;

create or replace function public.delete_item(p_list_id uuid, p_token text, p_item_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
begin
  perform private.assert_owner(p_list_id, p_token);
  delete from public.items where id = p_item_id and list_id = p_list_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- Reordenar: p_ids es un arreglo JSON con los ids en el orden nuevo
create or replace function public.reorder_items(p_list_id uuid, p_token text, p_ids jsonb)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
begin
  perform private.assert_owner(p_list_id, p_token);
  update public.items i set position = x.ord::integer - 1, updated_at = now()
  from jsonb_array_elements_text(p_ids) with ordinality as x(id, ord)
  where i.list_id = p_list_id and i.id = x.id::uuid;
  return jsonb_build_object('ok', true);
end $$;

-- Reservar un regalo (cualquiera con el enlace). Devuelve un token para deshacer.
create or replace function public.claim_item(p_item_id uuid, p_name text default null, p_qty integer default 1)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  v_item public.items;
  v_taken integer;
  v_qty integer := greatest(coalesce(p_qty, 1), 1);
  v_claim public.claims;
  v_token text := private.new_token();
begin
  select * into v_item from public.items where id = p_item_id for update;
  if not found or v_item.hidden then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  select coalesce(sum(qty), 0) into v_taken from public.claims where item_id = p_item_id;
  if v_taken + v_qty > v_item.qty then
    raise exception 'item_full' using errcode = 'P0001';
  end if;
  insert into public.claims (item_id, name, qty)
  values (p_item_id, nullif(btrim(p_name), ''), v_qty)
  returning * into v_claim;
  insert into private.claim_keys (claim_id, token_hash) values (v_claim.id, private.hash(v_token));
  return jsonb_build_object('claim', private.claim_json(v_claim), 'token', v_token);
end $$;

create or replace function public.unclaim(p_claim_id uuid, p_token text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.claims where id = p_claim_id) then
    return jsonb_build_object('ok', true);
  end if;
  if not exists (
    select 1 from private.claim_keys k where k.claim_id = p_claim_id and k.token_hash = private.hash(p_token)
  ) then
    raise exception 'invalid_token' using errcode = 'P0001';
  end if;
  delete from public.claims where id = p_claim_id;
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------------
-- Permisos: la llave pública solo puede ejecutar estas funciones
-- ---------------------------------------------------------------------
revoke all on all functions in schema private from public, anon, authenticated;
revoke all on function
  public.create_list(jsonb),
  public.get_list(text, text),
  public.check_token(text, text),
  public.update_list(uuid, text, jsonb),
  public.delete_list(uuid, text),
  public.save_item(uuid, text, jsonb),
  public.delete_item(uuid, text, uuid),
  public.reorder_items(uuid, text, jsonb),
  public.claim_item(uuid, text, integer),
  public.unclaim(uuid, text)
from public;
grant execute on function
  public.create_list(jsonb),
  public.get_list(text, text),
  public.check_token(text, text),
  public.update_list(uuid, text, jsonb),
  public.delete_list(uuid, text),
  public.save_item(uuid, text, jsonb),
  public.delete_item(uuid, text, uuid),
  public.reorder_items(uuid, text, jsonb),
  public.claim_item(uuid, text, integer),
  public.unclaim(uuid, text)
to anon, authenticated;

-- Avisa a la API que hay funciones nuevas
notify pgrst, 'reload schema';
