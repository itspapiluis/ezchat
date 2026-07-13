-- ============================================================
-- EZChat · PHASE 7 — PRODUCTION HARDENING
-- EasyCart Barcade & Lounge
-- Run in: Supabase Dashboard → SQL Editor → New Query → Paste → Run
-- Safe to re-run (idempotent).
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- 1. ERROR LOGGING
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS error_logs (
  id          BIGSERIAL PRIMARY KEY,
  context     TEXT NOT NULL,
  message     TEXT NOT NULL,
  stack       TEXT,
  meta        JSONB NOT NULL DEFAULT '{}',
  user_id     TEXT,
  table_id    TEXT,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_error_logs_created ON error_logs(created_at DESC);

ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

-- Guests can WRITE errors but never READ them back
DROP POLICY IF EXISTS "anon can log errors" ON error_logs;
CREATE POLICY "anon can log errors" ON error_logs
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "no one reads errors" ON error_logs;
-- (no SELECT policy = no reads via anon key; view them in the Supabase dashboard)


-- ════════════════════════════════════════════════════════════
-- 2. RATE LIMITING
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS rate_limits (
  id          BIGSERIAL PRIMARY KEY,
  bucket_key  TEXT NOT NULL,          -- device fingerprint or user id
  action      TEXT NOT NULL,          -- 'message' | 'dm' | 'image' | 'order' | 'join'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_lookup
  ON rate_limits(bucket_key, action, created_at DESC);

ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
-- No policies at all: only the SECURITY DEFINER function below can touch it.

-- Returns TRUE if the action is ALLOWED, FALSE if rate-limited.
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_key      TEXT,
  p_action   TEXT,
  p_max      INT,
  p_window   INT   -- seconds
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  IF p_key IS NULL OR p_key = '' THEN
    RETURN TRUE;   -- fail open rather than lock out a real guest
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM rate_limits
  WHERE bucket_key = p_key
    AND action     = p_action
    AND created_at > NOW() - (p_window || ' seconds')::INTERVAL;

  IF v_count >= p_max THEN
    RETURN FALSE;
  END IF;

  INSERT INTO rate_limits(bucket_key, action) VALUES (p_key, p_action);
  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION check_rate_limit(TEXT, TEXT, INT, INT) TO anon;


-- ════════════════════════════════════════════════════════════
-- 3. STAFF PIN — MOVED SERVER-SIDE (no more PINs in the browser)
-- ════════════════════════════════════════════════════════════

-- Make sure the PIN rows exist
INSERT INTO staff_config(key, value) VALUES
  ('pin_kitchen','111111'),
  ('pin_bar','222222'),
  ('pin_cashier','333333'),
  ('pin_admin','143143')
ON CONFLICT (key) DO NOTHING;

-- Verify a PIN without ever sending it to the client
CREATE OR REPLACE FUNCTION verify_staff_pin(p_role TEXT, p_pin TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stored TEXT;
BEGIN
  IF p_role NOT IN ('kitchen','bar','cashier','admin') THEN
    RETURN FALSE;
  END IF;

  SELECT value INTO v_stored
  FROM staff_config
  WHERE key = 'pin_' || p_role;

  RETURN v_stored IS NOT NULL AND v_stored = p_pin;
END;
$$;

GRANT EXECUTE ON FUNCTION verify_staff_pin(TEXT, TEXT) TO anon;


-- Change a PIN — requires the current admin PIN to authorise it.
CREATE OR REPLACE FUNCTION set_staff_pin(p_admin_pin TEXT, p_role TEXT, p_new_pin TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT verify_staff_pin('admin', p_admin_pin) THEN
    RETURN FALSE;                       -- wrong admin PIN
  END IF;
  IF p_role NOT IN ('kitchen','bar','cashier','admin') THEN
    RETURN FALSE;
  END IF;
  IF p_new_pin !~ '^\d{6}$' THEN
    RETURN FALSE;                       -- must be exactly 6 digits
  END IF;

  INSERT INTO staff_config(key, value, updated_at)
  VALUES ('pin_' || p_role, p_new_pin, NOW())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

  INSERT INTO staff_activity(role, action, details)
  VALUES ('admin', 'pin_changed', jsonb_build_object('role_changed', p_role));

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION set_staff_pin(TEXT, TEXT, TEXT) TO anon;


-- Lock down ONLY the pin_* rows. The rest of staff_config (alert thresholds
-- read by AlertEngine) must stay readable, or every staff dashboard breaks.
ALTER TABLE staff_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read staff_config"   ON staff_config;
DROP POLICY IF EXISTS "Anyone can update staff_config" ON staff_config;
DROP POLICY IF EXISTS "Anyone can insert staff_config" ON staff_config;
DROP POLICY IF EXISTS "read non-secret config"         ON staff_config;
DROP POLICY IF EXISTS "write non-secret config"        ON staff_config;
DROP POLICY IF EXISTS "update non-secret config"       ON staff_config;

-- PINs are invisible to the browser; everything else reads normally
CREATE POLICY "read non-secret config" ON staff_config
  FOR SELECT USING (key NOT LIKE 'pin\_%');

CREATE POLICY "write non-secret config" ON staff_config
  FOR INSERT WITH CHECK (key NOT LIKE 'pin\_%');

CREATE POLICY "update non-secret config" ON staff_config
  FOR UPDATE USING (key NOT LIKE 'pin\_%') WITH CHECK (key NOT LIKE 'pin\_%');
-- PINs are written only through set_staff_pin() above.


-- ════════════════════════════════════════════════════════════
-- 4. TIGHTENED RLS + ABUSE GUARDS
-- ════════════════════════════════════════════════════════════

-- Cap message length at the DB level (defence in depth vs. huge payload spam)
DO $$ BEGIN
  ALTER TABLE messages ADD CONSTRAINT msg_len CHECK (char_length(text) <= 600);
EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE direct_messages ADD CONSTRAINT dm_len CHECK (char_length(text) <= 600);
EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE users ADD CONSTRAINT name_len CHECK (char_length(name) BETWEEN 1 AND 40);
EXCEPTION WHEN duplicate_object OR undefined_table OR undefined_column THEN NULL; END $$;

-- Guests must never DELETE their own chat history or other people's rows.
-- (Admin deletes go through the admin panel, which uses the same anon key,
--  so DELETE stays enabled on messages/announcements — but is now locked
--  everywhere the app never deletes.)
DROP POLICY IF EXISTS "Anyone can delete users" ON users;
DROP POLICY IF EXISTS "Anyone can delete DMs"   ON direct_messages;

-- Error logs & rate limits are already locked above.

-- Financial tables: insert + read only, never delete from the client
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Anyone can delete receipts" ON receipts';
  EXECUTE 'DROP POLICY IF EXISTS "Anyone can delete orders" ON orders';
  EXECUTE 'DROP POLICY IF EXISTS "Anyone can delete order_items" ON order_items';
  EXECUTE 'DROP POLICY IF EXISTS "Anyone can delete void_logs" ON void_logs';
  EXECUTE 'DROP POLICY IF EXISTS "Anyone can delete audit_logs" ON audit_logs';
EXCEPTION WHEN undefined_table THEN NULL; END $$;


-- ════════════════════════════════════════════════════════════
-- 5. PERFORMANCE INDEXES (cuts Supabase egress + query time)
-- ════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_tab            ON orders(tab_id);
CREATE INDEX IF NOT EXISTS idx_orders_table          ON orders(table_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order     ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_tabs_open             ON table_tabs(table_id, status);
CREATE INDEX IF NOT EXISTS idx_users_status          ON users(status, last_seen DESC);
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_menu_items_cat ON menu_items(category_id, available);
EXCEPTION WHEN undefined_table OR undefined_column THEN
  RAISE NOTICE 'skipped idx_menu_items_cat (column/table not found)';
END $$;
CREATE INDEX IF NOT EXISTS idx_receipts_issued       ON receipts(issued_at DESC);


-- ════════════════════════════════════════════════════════════
-- 6. TAB TOTAL — SINGLE SOURCE OF TRUTH  (fixes 2 real money bugs)
-- ════════════════════════════════════════════════════════════
-- BUG 1: voiding an item never decremented table_tabs.total, so a tab's
--        headline total inflated forever with every void.
-- BUG 2: the app computed total as (old_total + new_items) from React state.
--        Two guests at one table ordering at once = lost update, money missing.
-- Fix: the DB recomputes the total from the items themselves, always.

CREATE OR REPLACE FUNCTION recalc_tab_total()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tab BIGINT;
BEGIN
  v_tab := COALESCE(NEW.tab_id, OLD.tab_id);
  IF v_tab IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  UPDATE table_tabs
     SET total = COALESCE((
           SELECT SUM(subtotal)
           FROM order_items
           WHERE tab_id = v_tab
             AND voided = FALSE
         ), 0)
   WHERE id = v_tab;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_recalc_tab_total ON order_items;
CREATE TRIGGER trg_recalc_tab_total
AFTER INSERT OR UPDATE OR DELETE ON order_items
FOR EACH ROW EXECUTE FUNCTION recalc_tab_total();

-- One-time backfill: repair every tab whose total already drifted
UPDATE table_tabs t
   SET total = COALESCE((
         SELECT SUM(oi.subtotal)
         FROM order_items oi
         WHERE oi.tab_id = t.id AND oi.voided = FALSE
       ), 0);


-- ════════════════════════════════════════════════════════════
-- 8. RACE-CONDITION BACKSTOPS (the DB refuses to double-charge)
-- ════════════════════════════════════════════════════════════

-- Repair any tables that ALREADY have 2+ live tabs (keep the newest, close the rest)
UPDATE table_tabs t
   SET status = 'closed', closed_at = NOW()
 WHERE t.status IN ('open','bill_requested')
   AND t.id <> (
     SELECT t2.id FROM table_tabs t2
      WHERE t2.table_id = t.table_id
        AND t2.status IN ('open','bill_requested')
      ORDER BY t2.opened_at DESC
      LIMIT 1
   );

-- Only ONE live tab per table, ever.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_live_tab_per_table
  ON table_tabs(table_id)
  WHERE status IN ('open','bill_requested');

-- Only ONE *PAID* receipt per tab. This is the hard stop against double-charging
-- a guest, even if two cashier devices tap "Confirm Payment" simultaneously.
--
-- It is deliberately a PARTIAL index (status='paid'). A receipt that was issued
-- in error can be marked status='void' and stays in your books as a record —
-- it just no longer blocks the tab. Never DELETE a receipt; void it.
--
-- BEFORE RUNNING: check for existing duplicates.
--   SELECT tab_id, COUNT(*) FROM receipts
--    WHERE status = 'paid' GROUP BY tab_id HAVING COUNT(*) > 1;
-- If that returns rows, resolve them first (void the erroneous one):
--   UPDATE receipts SET status = 'void' WHERE id = <the wrong receipt id>;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_paid_receipt_per_tab
  ON receipts(tab_id)
  WHERE status = 'paid';


-- ════════════════════════════════════════════════════════════
-- 9. AUTOMATIC CLEANUP (keeps the free tier alive)
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION cleanup_ezchat()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_users INT; v_msgs INT; v_dms INT; v_rl INT; v_err INT; v_tabs INT;
BEGIN
  -- Guests idle for 3h are removed (this cascades to their chat messages).
  -- CRITICAL: never touch a guest who has orders attached — if orders.user_id
  -- is declared ON DELETE CASCADE this would silently destroy sales history.
  -- (receipts link by tab_id, not user_id, so they are unaffected.)
  DELETE FROM users u
   WHERE u.last_seen < NOW() - INTERVAL '3 hours'
     AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.user_id = u.id);
  GET DIAGNOSTICS v_users = ROW_COUNT;

  -- Chat older than 24h
  DELETE FROM messages WHERE created_at < NOW() - INTERVAL '24 hours';
  GET DIAGNOSTICS v_msgs = ROW_COUNT;

  BEGIN
    DELETE FROM direct_messages WHERE created_at < NOW() - INTERVAL '24 hours';
    GET DIAGNOSTICS v_dms = ROW_COUNT;
  EXCEPTION WHEN undefined_table OR undefined_column THEN v_dms := 0;
  END;

  -- Rate limit rows older than 1h are dead weight
  DELETE FROM rate_limits WHERE created_at < NOW() - INTERVAL '1 hour';
  GET DIAGNOSTICS v_rl = ROW_COUNT;

  -- Keep 7 days of errors
  DELETE FROM error_logs WHERE created_at < NOW() - INTERVAL '7 days';
  GET DIAGNOSTICS v_err = ROW_COUNT;

  -- Auto-close tabs left open overnight (past closing, nothing pending)
  UPDATE table_tabs
     SET status = 'closed', closed_at = NOW()
   WHERE status = 'open'
     AND opened_at < NOW() - INTERVAL '12 hours';
  GET DIAGNOSTICS v_tabs = ROW_COUNT;

  RETURN format('users:%s msgs:%s dms:%s rate:%s err:%s tabs:%s',
                v_users, v_msgs, v_dms, v_rl, v_err, v_tabs);
END;
$$;

-- Schedule it. Requires the pg_cron extension:
--   Dashboard → Database → Extensions → search "pg_cron" → Enable
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Run every hour, on the hour (server time = UTC)
SELECT cron.unschedule('ezchat_cleanup')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ezchat_cleanup');

SELECT cron.schedule('ezchat_cleanup', '0 * * * *', $$SELECT cleanup_ezchat()$$);


-- ════════════════════════════════════════════════════════════
-- 7. DONE — verify
-- ════════════════════════════════════════════════════════════
-- SELECT cleanup_ezchat();                     -- run cleanup right now
-- SELECT * FROM cron.job;                      -- confirm the schedule exists
-- SELECT check_rate_limit('test','message',5,60);  -- should return true
-- SELECT verify_staff_pin('admin','143143');   -- should return true
-- SELECT * FROM error_logs ORDER BY created_at DESC LIMIT 20;
