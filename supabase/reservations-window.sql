-- EZChat reservations: "open bookings until" date.
-- Run AFTER supabase/reservations.sql (safe to run more than once).
--
-- By default guests can book until the last day of this month (unchanged).
-- An admin can now set a later date (Admin > Reservations > "Guests can book until")
-- so a future month, or an event night, can be opened early.
-- The window can only be stretched PAST month end; it never closes earlier than month end.
-- To undo: in Admin press Reset, or run:  update reservation_settings set open_until = null where id = 1;

alter table reservation_settings add column if not exists open_until date;

create or replace function reservation_max_date() returns date
language sql stable security definer set search_path = public as $$
  select greatest(
    (date_trunc('month', reservation_now()::date) + interval '1 month' - interval '1 day')::date,
    coalesce((select open_until from reservation_settings where id = 1), date '1900-01-01')) $$;

create or replace function reservation_public_config() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare t date := reservation_now()::date;
begin
  return jsonb_build_object(
    'enabled', reservation_enabled(),
    'hold_minutes', reservation_hold(),
    'auto_release', reservation_auto_release(),
    'min_date', t,
    'max_date', reservation_max_date(),
    'now', to_char(reservation_now(), 'YYYY-MM-DD"T"HH24:MI:SS'),
    'tables', coalesce((select jsonb_agg(jsonb_build_object(
        'table_id', table_id, 'label', label, 'area', area, 'capacity', capacity,
        'consumable', consumable, 'note', note) order by sort) from reservation_tables), '[]'::jsonb)
  );
end $$;

create or replace function reservation_create(p_date date, p_time time, p_table text, p_name text, p_phone text, p_guests int)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  nm text := trim(regexp_replace(coalesce(p_name, ''), '[[:cntrl:]]', '', 'g'));
  ph text := reservation_norm_phone(p_phone);
  tb reservation_tables%rowtype;
  today date := reservation_now()::date;
  mx date := reservation_max_date();
  cap int; active int; recent int; c text; n int := 0; cn text; rid uuid;
begin
  if not reservation_enabled() then return jsonb_build_object('ok', false, 'error', 'disabled'); end if;
  if length(nm) < 2 or length(nm) > 40 then return jsonb_build_object('ok', false, 'error', 'name'); end if;
  if ph is null then return jsonb_build_object('ok', false, 'error', 'phone'); end if;
  select * into tb from reservation_tables where table_id = p_table;
  if not found then return jsonb_build_object('ok', false, 'error', 'table'); end if;
  if p_guests is null or p_guests < 1 or p_guests > tb.capacity then return jsonb_build_object('ok', false, 'error', 'guests', 'max', tb.capacity); end if;
  if p_date is null or p_date < today or p_date > mx then return jsonb_build_object('ok', false, 'error', 'date'); end if;
  if p_time is null or p_time < time '18:00' or p_time > time '22:30'
     or extract(minute from p_time) not in (0, 30) or extract(second from p_time) <> 0 then
    return jsonb_build_object('ok', false, 'error', 'time');
  end if;
  if (p_date + p_time) <= reservation_now() then return jsonb_build_object('ok', false, 'error', 'past'); end if;

  -- release a no-show whose hold ran out, so the table can be booked again
  update reservations set status = 'expired', updated_at = now()
   where table_id = p_table and res_date = p_date and status = 'booked' and reservation_auto_release()
     and (res_date + res_time) + make_interval(mins => reservation_hold()) < reservation_now();

  select count(*) into active from reservations
   where phone = ph and reservation_eff(status, res_date, res_time) = 'booked';
  if active >= coalesce((select max_active_per_phone from reservation_settings where id = 1), 2) then
    return jsonb_build_object('ok', false, 'error', 'limit');
  end if;
  select count(*) into recent from reservations where phone = ph and created_at > now() - interval '10 minutes';
  if recent >= 3 then return jsonb_build_object('ok', false, 'error', 'slow'); end if;

  loop
    n := n + 1;
    c := reservation_gen_code();
    begin
      insert into reservations (code, table_id, res_date, res_time, guests, guest_name, phone)
        values (c, p_table, p_date, p_time, p_guests, nm, ph) returning id into rid;
      exit;
    exception when unique_violation then
      get stacked diagnostics cn = constraint_name;
      if cn = 'reservations_one_active' then return jsonb_build_object('ok', false, 'error', 'taken'); end if;
      if n >= 6 then return jsonb_build_object('ok', false, 'error', 'busy'); end if;
    end;
  end loop;
  return jsonb_build_object('ok', true, 'code', c, 'table_id', p_table, 'res_date', p_date,
                            'res_time', to_char(p_time, 'HH24:MI'), 'guests', p_guests, 'hold_minutes', reservation_hold());
end $$;

create or replace function reservation_admin_set_open_until(p_pin text, p_date date) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t date := reservation_now()::date;
begin
  if not reservation_admin_ok(p_pin) then raise exception 'forbidden'; end if;
  if p_date is not null and (p_date < t or p_date > t + 366) then
    return jsonb_build_object('ok', false, 'error', 'window');
  end if;
  update reservation_settings set open_until = p_date where id = 1;
  return jsonb_build_object('ok', true, 'max_date', reservation_max_date());
end $$;

grant execute on function reservation_max_date() to anon, authenticated;
grant execute on function reservation_public_config() to anon, authenticated;
grant execute on function reservation_create(date, time, text, text, text, int) to anon, authenticated;
grant execute on function reservation_admin_set_open_until(text, date) to anon, authenticated;
