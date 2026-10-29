-- Undo server-duty.sql. Removes only the server_duty() function; no data is touched.
drop function if exists server_duty();
