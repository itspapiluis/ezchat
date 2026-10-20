-- ============================================================================
-- EZChat Attendance module. ADDITIVE ONLY: every object is prefixed attendance_
-- Run once in Supabase > SQL Editor. Safe to re-run (idempotent).
-- Does NOT alter any existing table, column, function or policy.
-- Undo everything with attendance-rollback.sql
-- ============================================================================
create extension if not exists pgcrypto;

-- ---------- Tables (RLS on, no policies = no direct browser access) ----------
create table if not exists attendance_settings (
  id int primary key default 1 check (id = 1),
  bar_lat double precision not null default 0,   -- SET THIS: see bottom of file
  bar_lng double precision not null default 0
);
insert into attendance_settings (id) values (1) on conflict do nothing;

create table if not exists attendance_staff (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  pin_hash text not null,
  active boolean not null default true,
  failed_attempts int not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists attendance_hr (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create table if not exists attendance_logs (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references attendance_staff(id),
  type text not null check (type in ('in','out')),
  logged_at timestamptz not null default now(),   -- SERVER time: the only trusted timestamp
  selfie_path text,
  lat double precision,
  lng double precision,
  accuracy_m double precision,
  distance_m double precision,
  client_time timestamptz,                         -- server-corrected time printed on the watermark
  note text,
  is_correction boolean not null default false,
  created_by uuid
);
create index if not exists attendance_logs_staff_time on attendance_logs (staff_id, logged_at desc);
create index if not exists attendance_logs_time on attendance_logs (logged_at desc);

alter table attendance_settings enable row level security;
alter table attendance_staff enable row level security;
alter table attendance_hr enable row level security;
alter table attendance_logs enable row level security;

-- ---------- Helpers ----------
create or replace function attendance_is_hr() returns boolean
language sql security definer set search_path = public as $$
  select exists (select 1 from attendance_hr where user_id = auth.uid());
$$;

-- 6 digits, not all the same, not a repeated pair/triple, not a simple run.
create or replace function attendance_pin_ok(p_pin text) returns boolean
language sql immutable as $$
  select p_pin ~ '^\d{6}$'
     and p_pin !~ '^(\d)\1{5}$'
     and p_pin !~ '^(\d\d)\1\1$'
     and p_pin !~ '^(\d\d\d)\1$'
     and p_pin not in ('012345','123456','234567','345678','456789','567890',
                       '987654','876543','765432','654321','543210','098765');
$$;

-- Internal only. Returns 'ok' | 'wrong' | 'locked' | 'missing'. Never raises,
-- so the failed-attempt counter always persists.
create or replace function attendance_check_pin(p_staff uuid, p_pin text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare s attendance_staff; n int;
begin
  select * into s from attendance_staff where id = p_staff and active;
  if not found then return 'missing'; end if;
  if s.locked_until is not null and s.locked_until > now() then return 'locked'; end if;
  if s.pin_hash = crypt(p_pin, s.pin_hash) then
    update attendance_staff set failed_attempts = 0, locked_until = null where id = s.id;
    return 'ok';
  end if;
  n := s.failed_attempts + 1;
  update attendance_staff
     set failed_attempts = case when n >= 5 then 0 else n end,
         locked_until    = case when n >= 5 then now() + interval '10 minutes' else null end
   where id = s.id;
  return case when n >= 5 then 'locked' else 'wrong' end;
end $$;
revoke all on function attendance_check_pin(uuid, text) from public, anon, authenticated;

-- ---------- Staff-facing RPCs (called from /clock with the anon key) ----------
create or replace function attendance_staff_list() returns table(id uuid, name text)
language sql security definer set search_path = public as $$
  select s.id, s.name from attendance_staff s where s.active order by s.name;
$$;

-- Verifies the PIN and tells the phone what the next punch will be.
-- Rule: if the last log is an 'in' older than 14 hours, that shift is treated as
-- abandoned (forgotten clock-out) and the next punch is a fresh 'in'.
create or replace function attendance_begin(p_staff uuid, p_pin text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare st text; s_name text; last_type text; last_at timestamptz; nt text; cfg attendance_settings;
begin
  st := attendance_check_pin(p_staff, p_pin);
  if st <> 'ok' then return jsonb_build_object('ok', false, 'error', st); end if;
  select name into s_name from attendance_staff where id = p_staff;
  select type, logged_at into last_type, last_at
    from attendance_logs where staff_id = p_staff order by logged_at desc limit 1;
  nt := case when last_type = 'in' and last_at > now() - interval '14 hours' then 'out' else 'in' end;
  select * into cfg from attendance_settings where id = 1;
  return jsonb_build_object('ok', true, 'name', s_name, 'next_type', nt,
    'server_time', now(), 'bar_lat', cfg.bar_lat, 'bar_lng', cfg.bar_lng);
end $$;

create or replace function attendance_punch(
  p_staff uuid, p_pin text, p_lat double precision, p_lng double precision,
  p_accuracy double precision, p_client_time timestamptz
) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare st text; last_row attendance_logs; had_last boolean; new_type text;
        cfg attendance_settings; dist double precision; new_id uuid := gen_random_uuid();
begin
  -- One punch per person at a time: a second simultaneous request waits here, then
  -- sees the first log and gets "cooldown" instead of creating a duplicate.
  perform pg_advisory_xact_lock(hashtext('attendance:' || p_staff::text));
  st := attendance_check_pin(p_staff, p_pin);
  if st <> 'ok' then return jsonb_build_object('ok', false, 'error', st); end if;

  select * into last_row from attendance_logs where staff_id = p_staff order by logged_at desc limit 1;
  had_last := found;
  if had_last and last_row.logged_at > now() - interval '60 seconds' then
    return jsonb_build_object('ok', false, 'error', 'cooldown');
  end if;
  new_type := case when had_last and last_row.type = 'in'
                    and last_row.logged_at > now() - interval '14 hours' then 'out' else 'in' end;

  select * into cfg from attendance_settings where id = 1;
  if p_lat is not null and p_lng is not null then
    dist := 6371000 * 2 * asin(sqrt(
      power(sin(radians(p_lat - cfg.bar_lat) / 2), 2) +
      cos(radians(cfg.bar_lat)) * cos(radians(p_lat)) * power(sin(radians(p_lng - cfg.bar_lng) / 2), 2)));
  end if;

  insert into attendance_logs (id, staff_id, type, selfie_path, lat, lng, accuracy_m, distance_m, client_time)
  values (new_id, p_staff, new_type, new_id::text || '.jpg', p_lat, p_lng, p_accuracy, dist, p_client_time);

  return jsonb_build_object('ok', true, 'id', new_id, 'type', new_type,
                            'path', new_id::text || '.jpg', 'logged_at', now());
end $$;

-- ---------- Selfie storage (new private bucket; existing buckets untouched) ----------
insert into storage.buckets (id, name, public) values ('attendance-selfies', 'attendance-selfies', false)
on conflict do nothing;

-- Upload allowed only to a path that matches a log created in the last 10 minutes.
-- Insert-only: no overwrite, no delete from the browser.
create or replace function attendance_upload_ok(p_name text) returns boolean
language sql security definer set search_path = public as $$
  select exists (select 1 from attendance_logs
                  where selfie_path = p_name and logged_at > now() - interval '10 minutes');
$$;

drop policy if exists "attendance selfie upload" on storage.objects;
create policy "attendance selfie upload" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'attendance-selfies' and attendance_upload_ok(name));

drop policy if exists "attendance selfie hr read" on storage.objects;
create policy "attendance selfie hr read" on storage.objects for select to authenticated
  using (bucket_id = 'attendance-selfies' and attendance_is_hr());

-- ---------- HR RPCs (must be signed in AND listed in attendance_hr) ----------
create or replace function attendance_hr_logs(p_from timestamptz, p_to timestamptz)
returns table(id uuid, staff_id uuid, staff_name text, type text, logged_at timestamptz, selfie_path text,
              lat double precision, lng double precision, accuracy_m double precision,
              distance_m double precision, client_time timestamptz, note text, is_correction boolean)
language plpgsql security definer set search_path = public as $$
begin
  if not attendance_is_hr() then raise exception 'forbidden'; end if;
  return query
    select l.id, l.staff_id, s.name, l.type, l.logged_at, l.selfie_path, l.lat, l.lng, l.accuracy_m,
           l.distance_m, l.client_time, l.note, l.is_correction
      from attendance_logs l join attendance_staff s on s.id = l.staff_id
     where l.logged_at >= p_from and l.logged_at < p_to
     order by l.logged_at;
end $$;

create or replace function attendance_hr_staff()
returns table(id uuid, name text, active boolean, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not attendance_is_hr() then raise exception 'forbidden'; end if;
  return query select s.id, s.name, s.active, s.created_at from attendance_staff s
                order by s.active desc, s.name;
end $$;

create or replace function attendance_hr_create_staff(p_name text, p_pin text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not attendance_is_hr() then raise exception 'forbidden'; end if;
  if length(trim(coalesce(p_name, ''))) = 0 then raise exception 'Name required'; end if;
  if not attendance_pin_ok(p_pin) then
    raise exception 'PIN must be 6 digits and not simple (no 123456, 000000, 121212...)';
  end if;
  insert into attendance_staff (name, pin_hash) values (trim(p_name), crypt(p_pin, gen_salt('bf')));
end $$;

create or replace function attendance_hr_set_pin(p_staff uuid, p_pin text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not attendance_is_hr() then raise exception 'forbidden'; end if;
  if not attendance_pin_ok(p_pin) then
    raise exception 'PIN must be 6 digits and not simple (no 123456, 000000, 121212...)';
  end if;
  update attendance_staff
     set pin_hash = crypt(p_pin, gen_salt('bf')), failed_attempts = 0, locked_until = null
   where id = p_staff;
end $$;

create or replace function attendance_hr_set_active(p_staff uuid, p_active boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not attendance_is_hr() then raise exception 'forbidden'; end if;
  update attendance_staff set active = p_active where id = p_staff;
end $$;

-- Adds a NEW log marked as a correction. Original logs are never edited or deleted.
create or replace function attendance_hr_add_correction(p_staff uuid, p_type text, p_at timestamptz, p_note text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not attendance_is_hr() then raise exception 'forbidden'; end if;
  if p_type not in ('in','out') then raise exception 'Bad type'; end if;
  if p_note is null or length(trim(p_note)) < 3 then raise exception 'A note is required'; end if;
  if p_at > now() + interval '5 minutes' then raise exception 'Time is in the future'; end if;
  insert into attendance_logs (staff_id, type, logged_at, note, is_correction, created_by)
  values (p_staff, p_type, p_at, trim(p_note), true, auth.uid());
end $$;

-- ============================================================================
-- AFTER RUNNING THIS FILE (one time each, replace the values):
--
-- 1) Bar location (right-click the bar in Google Maps, click the numbers to copy):
--      update attendance_settings set bar_lat = 12.3456, bar_lng = 124.1234 where id = 1;
--
-- 2) Create the HR login: Supabase > Authentication > Users > Add user (email +
--    password, tick "Auto Confirm User"). Then:
--      insert into attendance_hr (user_id)
--      select id from auth.users where email = 'hr@example.com';
--    Repeat for each HR person (and for you, if you want access to /hr).
-- ============================================================================
