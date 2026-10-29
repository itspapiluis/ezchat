-- ============================================================================
-- EZChat RESERVATIONS. ADDITIVE ONLY. Run once in Supabase > SQL Editor.
-- Safe to re-run. Touches NO existing table. Needs the existing
-- verify_staff_pin(role, pin) function (already used by Admin login).
--
-- Rules (change the numbers in reservation_settings / the functions below):
--   * a guest can book any day from TODAY to the LAST DAY OF THIS MONTH
--     (Manila time). Next month opens when the month starts.
--   * arrival times: 6:00 PM to 11:30 PM, every 30 minutes
--   * a table is held 30 minutes after the arrival time, then it is released
--   * one active booking per table per date
--   * max 2 active bookings per phone number
--   * the public floor plan shows only Available / Reserved / Arrived,
--     never names or phone numbers
-- OFF by default. Turn on from Admin > Reservations, or:
--     update reservation_settings set enabled = true where id = 1;
-- Undo with reservations-rollback.sql
-- ============================================================================

create table if not exists reservation_settings (
  id int primary key default 1 check (id = 1),
  enabled boolean not null default false,
  hold_minutes int not null default 30,
  max_active_per_phone int not null default 2
);
insert into reservation_settings (id) values (1) on conflict (id) do nothing;

create table if not exists reservation_tables (
  table_id text primary key,
  label text not null,
  area text not null,
  capacity int not null check (capacity > 0),
  consumable int not null,
  note text,
  sort int not null default 0
);

insert into reservation_tables (table_id, label, area, capacity, consumable, note, sort) values
  ('M1','M1','First floor',4,2000,null,10),
  ('B1','B1','First floor',5,1500,null,20),('B2','B2','First floor',5,1500,null,21),('B3','B3','First floor',5,1500,null,22),
  ('B4','B4','First floor',5,1500,null,23),('B5','B5','First floor',5,1500,null,24),('B6','B6','First floor',5,1500,null,25),('B7','B7','First floor',5,1500,null,26),
  ('D1','D1','First floor',4,2500,null,30),('D2','D2','First floor',4,2500,null,31),('D3','D3','First floor',4,2500,null,32),('D4','D4','First floor',4,2500,null,33),('D5','D5','First floor',4,2500,null,34),
  ('C1','C1','First floor',6,2000,null,40),('C2','C2','First floor',6,2000,null,41),('C3','C3','First floor',6,2000,null,42),('C4','C4','First floor',6,2000,null,43),
  ('R1','R1','First floor',6,2500,null,50),('R2','R2','First floor',6,2500,null,51),('R3','R3','First floor',6,2500,null,52),('R4','R4','First floor',6,2500,null,53),
  ('F1','F1','First floor',6,2500,null,60),('F2','F2','First floor',6,2500,null,61),('F3','F3','First floor',6,2500,null,62),
  ('L1','L1','First floor',8,3500,null,70),('L2','L2','First floor',8,3500,null,71),('L3','L3','First floor',8,3500,null,72),
  ('KTV ROOM 1','KTV Room 1','Second floor',15,3500,'Consumable for the first 3 hours. PHP 350 per additional hour.',80),
  ('KTV ROOM 2','KTV Room 2','Second floor',15,3500,'Consumable for the first 3 hours. PHP 350 per additional hour.',81),
  ('SAPPHIRE','Sapphire','Second floor',10,5500,null,90),('RUBY','Ruby','Second floor',10,5500,null,91),('DIAMOND','Diamond','Second floor',10,5500,null,92)
on conflict (table_id) do nothing;

create table if not exists reservations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  table_id text not null references reservation_tables(table_id),
  res_date date not null,
  res_time time not null,
  guests int not null check (guests > 0),
  guest_name text not null,
  phone text not null,
  status text not null default 'booked' check (status in ('booked','arrived','no_show','cancelled','expired')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- one ACTIVE booking per table per date
create unique index if not exists reservations_one_active on reservations (table_id, res_date) where status in ('booked','arrived');
create index if not exists reservations_date_idx on reservations (res_date);
create index if not exists reservations_phone_idx on reservations (phone);

-- nobody reads or writes these tables directly; everything goes through the functions below
alter table reservation_settings enable row level security;
alter table reservation_tables enable row level security;
alter table reservations enable row level security;

-- ---------- helpers (internal) ----------
create or replace function reservation_now() returns timestamp
language sql stable as $$ select (now() at time zone 'Asia/Manila') $$;

create or replace function reservation_hold() returns int
language sql stable security definer set search_path = public as $$
  select coalesce((select hold_minutes from reservation_settings where id = 1), 30) $$;

-- what the booking really is right now: a 'booked' one past its hold counts as expired
create or replace function reservation_eff(p_status text, p_date date, p_time time) returns text
language sql stable security definer set search_path = public as $$
  select case when p_status = 'booked'
              and (p_date + p_time) + make_interval(mins => reservation_hold()) < reservation_now()
         then 'expired' else p_status end $$;

create or replace function reservation_norm_phone(p text) returns text
language sql immutable as $$
  select case
    when d ~ '^09[0-9]{9}$' then d
    when d ~ '^639[0-9]{9}$' then '0' || substr(d, 3)
    when d ~ '^9[0-9]{9}$' then '0' || d
    else null end
  from (select regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g') as d) x $$;

create or replace function reservation_admin_ok(p_pin text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(verify_staff_pin('admin', p_pin), false) $$;
revoke all on function reservation_admin_ok(text) from public, anon, authenticated;

create or replace function reservation_gen_code() returns text
language plpgsql volatile as $$
declare chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; out text := ''; i int;
begin
  for i in 1..6 loop out := out || substr(chars, 1 + floor(random() * length(chars))::int, 1); end loop;
  return out;
end $$;

-- ---------- public (guests) ----------
create or replace function reservation_enabled() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select enabled from reservation_settings where id = 1), false) $$;

-- everything the booking screen needs in one call
create or replace function reservation_public_config() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare t date := reservation_now()::date;
begin
  return jsonb_build_object(
    'enabled', reservation_enabled(),
    'hold_minutes', reservation_hold(),
    'min_date', t,
    'max_date', (date_trunc('month', t) + interval '1 month' - interval '1 day')::date,
    'now', to_char(reservation_now(), 'YYYY-MM-DD"T"HH24:MI:SS'),
    'tables', coalesce((select jsonb_agg(jsonb_build_object(
        'table_id', table_id, 'label', label, 'area', area, 'capacity', capacity,
        'consumable', consumable, 'note', note) order by sort) from reservation_tables), '[]'::jsonb)
  );
end $$;

-- which tables are taken on a date. NO names, NO phone numbers.
create or replace function reservation_taken(p_date date) returns table(table_id text, status text)
language sql stable security definer set search_path = public as $$
  select r.table_id, reservation_eff(r.status, r.res_date, r.res_time)
    from reservations r
   where r.res_date = p_date
     and reservation_eff(r.status, r.res_date, r.res_time) in ('booked','arrived') $$;

create or replace function reservation_create(p_date date, p_time time, p_table text, p_name text, p_phone text, p_guests int)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  nm text := trim(regexp_replace(coalesce(p_name, ''), '[[:cntrl:]]', '', 'g'));
  ph text := reservation_norm_phone(p_phone);
  tb reservation_tables%rowtype;
  today date := reservation_now()::date;
  mx date := (date_trunc('month', reservation_now()::date) + interval '1 month' - interval '1 day')::date;
  cap int; active int; recent int; c text; n int := 0; cn text; rid uuid;
begin
  if not reservation_enabled() then return jsonb_build_object('ok', false, 'error', 'disabled'); end if;
  if length(nm) < 2 or length(nm) > 40 then return jsonb_build_object('ok', false, 'error', 'name'); end if;
  if ph is null then return jsonb_build_object('ok', false, 'error', 'phone'); end if;
  select * into tb from reservation_tables where table_id = p_table;
  if not found then return jsonb_build_object('ok', false, 'error', 'table'); end if;
  if p_guests is null or p_guests < 1 or p_guests > tb.capacity then return jsonb_build_object('ok', false, 'error', 'guests', 'max', tb.capacity); end if;
  if p_date is null or p_date < today or p_date > mx then return jsonb_build_object('ok', false, 'error', 'date'); end if;
  if p_time is null or p_time < time '18:00' or p_time > time '23:30'
     or extract(minute from p_time) not in (0, 30) or extract(second from p_time) <> 0 then
    return jsonb_build_object('ok', false, 'error', 'time');
  end if;
  if (p_date + p_time) <= reservation_now() then return jsonb_build_object('ok', false, 'error', 'past'); end if;

  -- release a no-show whose hold ran out, so the table can be booked again
  update reservations set status = 'expired', updated_at = now()
   where table_id = p_table and res_date = p_date and status = 'booked'
     and (res_date + res_time) + make_interval(mins => reservation_hold()) < reservation_now();

  select count(*) into active from reservations
   where phone = ph and reservation_eff(status, res_date, res_time) = 'booked';
  if active >= coalesce((select max_active_per_phone from reservation_settings where id = 1), 2) then
    return jsonb_build_object('ok', false, 'error', 'limit');
  end if;
  select count(*) into recent from reservations where phone = ph and created_at > now() - interval '10 minutes';
  if recent >= 3 then return jsonb_build_object('ok', false, 'error', 'slow'); end if;

  loop
    n := n + 1;
    c := reservation_gen_code();
    begin
      insert into reservations (code, table_id, res_date, res_time, guests, guest_name, phone)
        values (c, p_table, p_date, p_time, p_guests, nm, ph) returning id into rid;
      exit;
    exception when unique_violation then
      get stacked diagnostics cn = constraint_name;
      if cn = 'reservations_one_active' then return jsonb_build_object('ok', false, 'error', 'taken'); end if;
      if n >= 6 then return jsonb_build_object('ok', false, 'error', 'busy'); end if;
    end;
  end loop;
  return jsonb_build_object('ok', true, 'code', c, 'table_id', p_table, 'res_date', p_date,
                            'res_time', to_char(p_time, 'HH24:MI'), 'guests', p_guests, 'hold_minutes', reservation_hold());
end $$;

-- look up your booking: code + last 4 digits of your phone
create or replace function reservation_lookup(p_code text, p_phone4 text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r reservations%rowtype;
begin
  select * into r from reservations
   where code = upper(trim(coalesce(p_code, ''))) and right(phone, 4) = trim(coalesce(p_phone4, ''));
  if not found then return jsonb_build_object('ok', false, 'error', 'notfound'); end if;
  return jsonb_build_object('ok', true, 'code', r.code, 'table_id', r.table_id, 'res_date', r.res_date,
    'res_time', to_char(r.res_time, 'HH24:MI'), 'guests', r.guests, 'name', r.guest_name,
    'status', reservation_eff(r.status, r.res_date, r.res_time), 'hold_minutes', reservation_hold());
end $$;

create or replace function reservation_cancel(p_code text, p_phone4 text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r reservations%rowtype;
begin
  select * into r from reservations
   where code = upper(trim(coalesce(p_code, ''))) and right(phone, 4) = trim(coalesce(p_phone4, ''));
  if not found then return jsonb_build_object('ok', false, 'error', 'notfound'); end if;
  if reservation_eff(r.status, r.res_date, r.res_time) <> 'booked' then
    return jsonb_build_object('ok', false, 'error', 'not_cancellable', 'status', reservation_eff(r.status, r.res_date, r.res_time));
  end if;
  update reservations set status = 'cancelled', updated_at = now() where id = r.id;
  return jsonb_build_object('ok', true);
end $$;

-- ---------- admin (needs the admin PIN, checked on the server) ----------
create or replace function reservation_admin_list(p_pin text, p_from date, p_to date)
returns table(id uuid, code text, table_id text, res_date date, res_time text, guests int, guest_name text, phone text,
              status text, note text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not reservation_admin_ok(p_pin) then raise exception 'forbidden'; end if;
  return query
    select r.id, r.code, r.table_id, r.res_date, to_char(r.res_time, 'HH24:MI'), r.guests, r.guest_name, r.phone,
           reservation_eff(r.status, r.res_date, r.res_time), r.note, r.created_at
      from reservations r
     where r.res_date between p_from and p_to
     order by r.res_date, r.res_time, r.table_id;
end $$;

create or replace function reservation_admin_set(p_pin text, p_id uuid, p_status text, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not reservation_admin_ok(p_pin) then raise exception 'forbidden'; end if;
  if p_status not in ('booked','arrived','no_show','cancelled') then return jsonb_build_object('ok', false, 'error', 'status'); end if;
  begin
    update reservations set status = p_status, note = coalesce(p_note, note), updated_at = now() where id = p_id;
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'taken');
  end;
  if not found then return jsonb_build_object('ok', false, 'error', 'notfound'); end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function reservation_admin_move(p_pin text, p_id uuid, p_table text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare cap int; g int;
begin
  if not reservation_admin_ok(p_pin) then raise exception 'forbidden'; end if;
  select capacity into cap from reservation_tables where table_id = p_table;
  if cap is null then return jsonb_build_object('ok', false, 'error', 'table'); end if;
  select guests into g from reservations where id = p_id;
  if g is null then return jsonb_build_object('ok', false, 'error', 'notfound'); end if;
  if g > cap then return jsonb_build_object('ok', false, 'error', 'capacity', 'max', cap); end if;
  begin
    update reservations set table_id = p_table, updated_at = now() where id = p_id;
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'taken');
  end;
  return jsonb_build_object('ok', true);
end $$;

-- staff booking for a phone call or walk-up: any time of day, today or later, no per-phone limit
create or replace function reservation_admin_create(p_pin text, p_date date, p_time time, p_table text, p_name text, p_phone text, p_guests int)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  nm text := trim(regexp_replace(coalesce(p_name, ''), '[[:cntrl:]]', '', 'g'));
  ph text := reservation_norm_phone(p_phone);
  cap int; c text; n int := 0; cn text;
begin
  if not reservation_admin_ok(p_pin) then raise exception 'forbidden'; end if;
  if length(nm) < 2 or length(nm) > 40 then return jsonb_build_object('ok', false, 'error', 'name'); end if;
  if ph is null then return jsonb_build_object('ok', false, 'error', 'phone'); end if;
  select capacity into cap from reservation_tables where table_id = p_table;
  if cap is null then return jsonb_build_object('ok', false, 'error', 'table'); end if;
  if p_guests is null or p_guests < 1 or p_guests > cap then return jsonb_build_object('ok', false, 'error', 'guests', 'max', cap); end if;
  if p_date is null or p_date < reservation_now()::date then return jsonb_build_object('ok', false, 'error', 'date'); end if;
  update reservations set status = 'expired', updated_at = now()
   where table_id = p_table and res_date = p_date and status = 'booked'
     and (res_date + res_time) + make_interval(mins => reservation_hold()) < reservation_now();
  loop
    n := n + 1; c := reservation_gen_code();
    begin
      insert into reservations (code, table_id, res_date, res_time, guests, guest_name, phone)
        values (c, p_table, p_date, coalesce(p_time, time '18:00'), p_guests, nm, ph);
      exit;
    exception when unique_violation then
      get stacked diagnostics cn = constraint_name;
      if cn = 'reservations_one_active' then return jsonb_build_object('ok', false, 'error', 'taken'); end if;
      if n >= 6 then return jsonb_build_object('ok', false, 'error', 'busy'); end if;
    end;
  end loop;
  return jsonb_build_object('ok', true, 'code', c);
end $$;

create or replace function reservation_admin_set_enabled(p_pin text, p_enabled boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not reservation_admin_ok(p_pin) then raise exception 'forbidden'; end if;
  update reservation_settings set enabled = coalesce(p_enabled, false) where id = 1;
  return jsonb_build_object('ok', true, 'enabled', coalesce(p_enabled, false));
end $$;

grant execute on function reservation_enabled() to anon, authenticated;
grant execute on function reservation_public_config() to anon, authenticated;
grant execute on function reservation_taken(date) to anon, authenticated;
grant execute on function reservation_create(date, time, text, text, text, int) to anon, authenticated;
grant execute on function reservation_lookup(text, text) to anon, authenticated;
grant execute on function reservation_cancel(text, text) to anon, authenticated;
grant execute on function reservation_admin_list(text, date, date) to anon, authenticated;
grant execute on function reservation_admin_set(text, uuid, text, text) to anon, authenticated;
grant execute on function reservation_admin_move(text, uuid, text) to anon, authenticated;
grant execute on function reservation_admin_create(text, date, time, text, text, text, int) to anon, authenticated;
grant execute on function reservation_admin_set_enabled(text, boolean) to anon, authenticated;
