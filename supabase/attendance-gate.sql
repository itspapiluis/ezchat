-- ============================================================================
-- EZChat Attendance GATE. ADDITIVE ONLY. Run once in Supabase > SQL Editor,
-- AFTER attendance.sql. Safe to re-run.
--
-- Touches NO existing table. It only:
--   * adds one column to attendance_settings (our own table): gate_enabled
--   * adds four attendance_ functions
--   * READS servers / server_assignments / table_tabs inside one function
--
-- The gate is OFF by default. Nothing changes for staff until you run, at the
-- bottom of this file, the "turn the gate ON" line.
-- Undo with attendance-gate-rollback.sql
-- ============================================================================

alter table attendance_settings
  add column if not exists gate_enabled boolean not null default false;

-- Is the gate switched on? (readable by the staff screens)
create or replace function attendance_gate_enabled() returns boolean
language sql security definer set search_path = public as $$
  select coalesce((select gate_enabled from attendance_settings where id = 1), false);
$$;

-- Is this person clocked in right now? Yes/no only, no PIN needed.
-- Same 14-hour rule as attendance_begin / attendance_punch.
create or replace function attendance_on_shift(p_staff uuid) returns boolean
language sql security definer set search_path = public as $$
  select coalesce((
    select (l.type = 'in' and l.logged_at > now() - interval '14 hours')
      from attendance_logs l
      join attendance_staff s on s.id = l.staff_id and s.active
     where l.staff_id = p_staff
     order by l.logged_at desc
     limit 1
  ), false);
$$;

-- The name the Server screen knows this person by. If an active row in
-- `servers` has the same name (ignoring case and spaces) we return THAT spelling,
-- so table assignments line up exactly. Otherwise we return the attendance name.
create or replace function attendance_server_name(p_staff uuid) returns text
language plpgsql security definer set search_path = public as $$
declare n text;
begin
  select sv.name into n
    from attendance_staff s
    join servers sv on lower(trim(sv.name)) = lower(trim(s.name)) and sv.active
   where s.id = p_staff
   limit 1;
  if n is null then
    select s.name into n from attendance_staff s where s.id = p_staff;
  end if;
  return n;
exception when others then
  return (select s.name from attendance_staff s where s.id = p_staff);
end $$;

-- Tables this person is watching (server_assignments) that still have an open tab.
-- Used only for the "you still have open tables" WARNING at end of shift.
-- Never raises: on any problem it returns an empty list, so it can never block.
create or replace function attendance_open_tabs(p_staff uuid) returns text[]
language plpgsql security definer set search_path = public as $$
declare r text[];
begin
  select coalesce(array_agg(x.table_id order by x.table_id), '{}') into r
    from (
      select distinct a.table_id
        from attendance_staff s
        join servers sv on lower(trim(sv.name)) = lower(trim(s.name))
        join server_assignments a on a.server_id = sv.id
       where s.id = p_staff
         and exists (
           select 1 from table_tabs t
            where t.table_id = a.table_id
              and t.status in ('open', 'bill_requested')
         )
    ) x;
  return coalesce(r, '{}');
exception when others then
  return '{}';
end $$;

grant execute on function attendance_gate_enabled() to anon, authenticated;
grant execute on function attendance_on_shift(uuid) to anon, authenticated;
grant execute on function attendance_server_name(uuid) to anon, authenticated;
grant execute on function attendance_open_tabs(uuid) to anon, authenticated;

-- ============================================================================
-- TURN THE GATE ON (only when every staff member has a name + PIN in HR > Staff):
--     update attendance_settings set gate_enabled = true where id = 1;
-- TURN IT OFF AGAIN (instant, no redeploy needed):
--     update attendance_settings set gate_enabled = false where id = 1;
--
-- CHECK: which attendance names do NOT match a name in your Server list?
-- (Only matters for people who use the Server screen.)
--     select s.name from attendance_staff s
--      where s.active and not exists
--        (select 1 from servers v where lower(trim(v.name)) = lower(trim(s.name)));
-- ============================================================================
