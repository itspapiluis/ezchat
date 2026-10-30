-- ============================================================================
-- EZChat HR: delete a staff account. ADDITIVE. Run once in Supabase > SQL Editor,
-- AFTER attendance.sql and attendance-servers.sql. Safe to re-run.
--
-- attendance_hr_delete_staff(staff, with_history)
--   * Only HR can call it (same check as the other HR functions).
--   * If the person has NO attendance records: the account is deleted.
--   * If they HAVE records and with_history is false: nothing is deleted, it answers
--     {ok:false, error:'has_history', logs:N}. HR then chooses Deactivate (keeps the
--     history) or confirms "delete everything".
--   * with_history true: deletes their attendance records and the account.
--     Selfie image files stay in storage (they are not touched).
--   * The matching row in `servers` is only HIDDEN (active = false), never deleted,
--     so table assignments and old orders stay intact.
-- Undo with attendance-delete-rollback.sql (removes the function only).
-- ============================================================================
create or replace function attendance_hr_delete_staff(p_staff uuid, p_with_history boolean default false)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare nm text; n int;
begin
  if not attendance_is_hr() then raise exception 'forbidden'; end if;
  select name into nm from attendance_staff where id = p_staff;
  if nm is null then return jsonb_build_object('ok', false, 'error', 'notfound'); end if;
  select count(*) into n from attendance_logs where staff_id = p_staff;
  if n > 0 and not coalesce(p_with_history, false) then
    return jsonb_build_object('ok', false, 'error', 'has_history', 'logs', n);
  end if;
  update servers set active = false where lower(trim(name)) = lower(trim(nm));
  delete from attendance_logs where staff_id = p_staff;
  delete from attendance_staff where id = p_staff;
  return jsonb_build_object('ok', true, 'name', nm, 'logs_deleted', n);
end $$;
grant execute on function attendance_hr_delete_staff(uuid, boolean) to authenticated;
