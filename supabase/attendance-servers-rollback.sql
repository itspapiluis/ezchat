-- Rollback for attendance-servers.sql. Restores attendance_hr_set_active to its
-- original form and removes the new functions and column.
-- NOTE: `servers` rows that were created or hidden by this feature are NOT
-- changed back (nothing was ever deleted). Fix them in the Admin screen if needed.
create or replace function attendance_hr_set_active(p_staff uuid, p_active boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not attendance_is_hr() then raise exception 'forbidden'; end if;
  update attendance_staff set active = p_active where id = p_staff;
end $$;
drop function if exists attendance_hr_add_staff(text, text, boolean);
drop function if exists attendance_hr_set_server(uuid, boolean);
drop function if exists attendance_hr_server_flags();
drop function if exists attendance_sync_server(uuid);
alter table attendance_staff drop column if exists is_server;
