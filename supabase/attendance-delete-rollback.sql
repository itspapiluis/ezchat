-- Undo attendance-delete.sql. Removes only the function; no data is touched.
drop function if exists attendance_hr_delete_staff(uuid, boolean);
