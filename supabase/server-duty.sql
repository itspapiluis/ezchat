-- ============================================================================
-- EZChat Server board: "who is on duty". ADDITIVE, READ-ONLY. Run once in
-- Supabase > SQL Editor, AFTER attendance.sql. Safe to re-run.
--
-- Adds ONE function, server_duty(). It only READS servers, attendance_staff
-- and attendance_logs. It changes no table and no data.
-- It returns, for each server: whether they are clocked in right now (same
-- 14-hour rule as attendance_on_shift) and since when. Names are matched to the
-- HR (attendance) account ignoring case and spaces.
-- Undo with server-duty-rollback.sql
-- ============================================================================
create or replace function server_duty()
returns table(server_id bigint, name text, active boolean, linked boolean, on_duty boolean, since timestamptz)
language sql security definer set search_path = public as $$
  select sv.id,
         sv.name,
         sv.active,
         (s.id is not null),
         coalesce(l.type = 'in' and l.logged_at > now() - interval '14 hours', false),
         case when l.type = 'in' and l.logged_at > now() - interval '14 hours' then l.logged_at end
    from servers sv
    left join attendance_staff s
           on lower(trim(s.name)) = lower(trim(sv.name)) and s.active
    left join lateral (
           select x.type, x.logged_at from attendance_logs x
            where x.staff_id = s.id order by x.logged_at desc limit 1
         ) l on true
   order by sv.name;
$$;
grant execute on function server_duty() to anon, authenticated;
