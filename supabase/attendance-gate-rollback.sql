-- ============================================================================
-- ROLLBACK for the attendance GATE only. The clock-in/clock-out module
-- (attendance.sql) and all logs are left untouched.
-- Switch the gate off first if you only want to pause it:
--     update attendance_settings set gate_enabled = false where id = 1;
-- ============================================================================
drop function if exists attendance_open_tabs(uuid);
drop function if exists attendance_server_name(uuid);
drop function if exists attendance_on_shift(uuid);
drop function if exists attendance_gate_enabled();
alter table attendance_settings drop column if exists gate_enabled;
