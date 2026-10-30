-- Removes the reservations feature completely. Deletes all reservation data.
-- Turn the feature off first if you only want to pause it:
--     update reservation_settings set enabled = false where id = 1;
drop function if exists reservation_admin_set_auto_release(text, boolean);
drop function if exists reservation_admin_set_enabled(text, boolean);
drop function if exists reservation_admin_create(text, date, time, text, text, text, int);
drop function if exists reservation_admin_move(text, uuid, text);
drop function if exists reservation_admin_set(text, uuid, text, text);
drop function if exists reservation_admin_list(text, date, date);
drop function if exists reservation_cancel(text, text);
drop function if exists reservation_lookup(text, text);
drop function if exists reservation_create(date, time, text, text, text, int);
drop function if exists reservation_taken(date);
drop function if exists reservation_public_config();
drop function if exists reservation_enabled();
drop function if exists reservation_gen_code();
drop function if exists reservation_admin_ok(text);
drop function if exists reservation_norm_phone(text);
drop function if exists reservation_eff(text, date, time);
drop function if exists reservation_auto_release();
drop function if exists reservation_hold();
drop function if exists reservation_now();
drop table if exists reservations;
drop table if exists reservation_tables;
drop table if exists reservation_settings;
