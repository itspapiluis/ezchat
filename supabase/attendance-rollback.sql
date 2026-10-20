-- ============================================================================
-- ROLLBACK for the EZChat attendance module. Drops ONLY attendance_ objects.
-- WARNING: this permanently deletes all attendance logs and staff PINs.
-- Before running: Supabase > Storage > attendance-selfies > select all > Delete
-- (the bucket must be empty before it can be removed).
-- ============================================================================

-- storage policies (scoped to the attendance bucket only)
drop policy if exists "attendance selfie upload" on storage.objects;
drop policy if exists "attendance selfie hr read" on storage.objects;

-- functions
drop function if exists attendance_hr_add_correction(uuid, text, timestamptz, text);
drop function if exists attendance_hr_set_active(uuid, boolean);
drop function if exists attendance_hr_set_pin(uuid, text);
drop function if exists attendance_hr_create_staff(text, text);
drop function if exists attendance_hr_staff();
drop function if exists attendance_hr_logs(timestamptz, timestamptz);
drop function if exists attendance_upload_ok(text);
drop function if exists attendance_punch(uuid, text, double precision, double precision, double precision, timestamptz);
drop function if exists attendance_begin(uuid, text);
drop function if exists attendance_staff_list();
drop function if exists attendance_check_pin(uuid, text);
drop function if exists attendance_pin_ok(text);
drop function if exists attendance_is_hr();

-- tables (logs first, they reference staff)
drop table if exists attendance_logs;
drop table if exists attendance_staff;
drop table if exists attendance_hr;
drop table if exists attendance_settings;

-- bucket (works only once it is empty)
delete from storage.buckets where id = 'attendance-selfies';
