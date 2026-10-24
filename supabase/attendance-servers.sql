-- ============================================================================
-- EZChat Attendance: HR manages who is a SERVER. Run once in Supabase >
-- SQL Editor, AFTER attendance.sql and attendance-gate.sql. Safe to re-run.
--
-- What it does
--   * adds attendance_staff.is_server (our own table)
--   * HR can tick "Works as server" when adding staff, or later per person.
--     Ticked => a row exists in `servers` and is active (created if missing).
--     Unticked or deactivated => that servers row is hidden (active = false).
--   * existing servers whose name matches an HR account are marked as servers
--     once, right now. NO servers row is ever deleted, so table assignments
--     and history stay intact.
-- Only touches `servers` by name (case/space-insensitive), and only its
-- `name` and `active` columns.
-- Undo with attendance-servers-rollback.sql
-- ============================================================================

alter table attendance_staff
  add column if not exists is_server boolean not null default false;

-- One-time link: HR accounts that already match an active server.
update attendance_staff s set is_server = true
 where s.active and not s.is_server
   and exists (select 1 from servers v
                where v.active and lower(trim(v.name)) = lower(trim(s.name)));

-- Make the `servers` row for this person exist and match their active state.
-- Internal helper: NOT granted to anon/authenticated.
create or replace function attendance_sync_server(p_staff uuid) returns void
language plpgsql security definer set search_path = public as $$
declare s record;
begin
  select * into s from attendance_staff where id = p_staff;
  if not found or not s.is_server then return; end if;
  if exists (select 1 from servers v where lower(trim(v.name)) = lower(trim(s.name))) then
    update servers v set active = s.active where lower(trim(v.name)) = lower(trim(s.name));
  elsif s.active then
    insert into servers (name) values (trim(s.name));
  end if;
end $$;
revoke all on function attendance_sync_server(uuid) from public, anon, authenticated;

-- Which staff are servers (separate from attendance_hr_staff so that one is unchanged).
create or replace function attendance_hr_server_flags() returns table(id uuid, is_server boolean)
language plpgsql security definer set search_path = public as $$
begin
  if not attendance_is_hr() then raise exception 'forbidden'; end if;
  return query select s.id, s.is_server from attendance_staff s;
end $$;

-- Tick / untick "Works as server" for an existing person.
create or replace function attendance_hr_set_server(p_staff uuid, p_server boolean) returns void
language plpgsql security definer set search_path = public as $$
declare nm text;
begin
  if not attendance_is_hr() then raise exception 'forbidden'; end if;
  update attendance_staff set is_server = coalesce(p_server, false) where id = p_staff returning name into nm;
  if nm is null then raise exception 'Staff not found'; end if;
  if p_server then
    perform attendance_sync_server(p_staff);
  else
    update servers set active = false where lower(trim(name)) = lower(trim(nm));
  end if;
end $$;

-- Add a person, optionally as a server, in one step. Same checks as attendance_hr_create_staff.
create or replace function attendance_hr_add_staff(p_name text, p_pin text, p_is_server boolean default false) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare new_id uuid;
begin
  if not attendance_is_hr() then raise exception 'forbidden'; end if;
  if length(trim(coalesce(p_name, ''))) = 0 then raise exception 'Name required'; end if;
  if not attendance_pin_ok(p_pin) then
    raise exception 'PIN must be 6 digits and not simple (no 123456, 000000, 121212...)';
  end if;
  insert into attendance_staff (name, pin_hash, is_server)
    values (trim(p_name), crypt(p_pin, gen_salt('bf')), coalesce(p_is_server, false))
    returning id into new_id;
  if p_is_server then perform attendance_sync_server(new_id); end if;
  return new_id;
end $$;

-- Same as before, plus: deactivating/activating a server also hides/shows them in the Server list.
create or replace function attendance_hr_set_active(p_staff uuid, p_active boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not attendance_is_hr() then raise exception 'forbidden'; end if;
  update attendance_staff set active = p_active where id = p_staff;
  perform attendance_sync_server(p_staff);
end $$;

grant execute on function attendance_hr_server_flags() to authenticated;
grant execute on function attendance_hr_set_server(uuid, boolean) to authenticated;
grant execute on function attendance_hr_add_staff(text, text, boolean) to authenticated;
