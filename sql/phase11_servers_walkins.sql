-- ============================================================
-- EZChat · PHASE 11 — SERVERS, WALK-INS & VOID PROTECTION
-- Run in Supabase SQL Editor. Safe to re-run.
-- ============================================================
--   1. A SERVER staff role
--   2. A separate VOID PIN (gate every void)
--   3. Walk-in tabs (a tab identified by a guest's NAME, no QR)
--   4. Tag every order with the server who placed it
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- 1. NEW PINS: server + void
-- ════════════════════════════════════════════════════════════
INSERT INTO staff_config(key, value) VALUES
  ('pin_server','444444'),
  ('pin_void','000111')          -- CHANGE THIS after deploy
ON CONFLICT (key) DO NOTHING;

-- verify_staff_pin already covers 'server' if we widen its allow-list.
CREATE OR REPLACE FUNCTION verify_staff_pin(p_role TEXT, p_pin TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_stored TEXT;
BEGIN
  IF p_role NOT IN ('kitchen','bar','cashier','admin','server') THEN
    RETURN FALSE;
  END IF;
  SELECT value INTO v_stored FROM staff_config WHERE key = 'pin_' || p_role;
  RETURN v_stored IS NOT NULL AND v_stored = p_pin;
END $$;
GRANT EXECUTE ON FUNCTION verify_staff_pin(TEXT,TEXT) TO anon;

-- The void PIN is checked on its own so it can differ from any login PIN.
CREATE OR REPLACE FUNCTION verify_void_pin(p_pin TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_stored TEXT;
BEGIN
  SELECT value INTO v_stored FROM staff_config WHERE key = 'pin_void';
  RETURN v_stored IS NOT NULL AND v_stored = p_pin;
END $$;
GRANT EXECUTE ON FUNCTION verify_void_pin(TEXT) TO anon;

-- Let set_staff_pin manage the two new keys too.
CREATE OR REPLACE FUNCTION set_staff_pin(p_admin_pin TEXT, p_role TEXT, p_new_pin TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT verify_staff_pin('admin', p_admin_pin) THEN RETURN FALSE; END IF;
  IF p_role NOT IN ('kitchen','bar','cashier','admin','server','void') THEN RETURN FALSE; END IF;
  IF p_new_pin !~ '^\d{6}$' THEN RETURN FALSE; END IF;

  INSERT INTO staff_config(key, value, updated_at)
  VALUES ('pin_' || p_role, p_new_pin, NOW())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

  INSERT INTO staff_activity(role, action, details)
  VALUES ('admin', 'pin_changed', jsonb_build_object('role_changed', p_role));
  RETURN TRUE;
END $$;
GRANT EXECUTE ON FUNCTION set_staff_pin(TEXT,TEXT,TEXT) TO anon;


-- ════════════════════════════════════════════════════════════
-- 2. SERVER NAMES (shared PIN → pick your name)
-- ════════════════════════════════════════════════════════════
-- Individual accounts without password management: everyone enters the shared
-- SERVER pin, then picks their name. Every order they place is tagged with it.
CREATE TABLE IF NOT EXISTS servers (
  id         BIGSERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE servers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read servers" ON servers;
CREATE POLICY "read servers" ON servers FOR SELECT USING (true);
DROP POLICY IF EXISTS "manage servers" ON servers;
CREATE POLICY "manage servers" ON servers FOR ALL USING (true) WITH CHECK (true);

-- A couple to start; admin edits the rest in the panel.
INSERT INTO servers(name) VALUES ('Server 1'),('Server 2')
ON CONFLICT DO NOTHING;

-- Which tables a server is watching (assignment = a personal filter, not a lock).
CREATE TABLE IF NOT EXISTS server_assignments (
  server_id  BIGINT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  table_id   TEXT   NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (server_id, table_id)
);
ALTER TABLE server_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rw assignments" ON server_assignments;
CREATE POLICY "rw assignments" ON server_assignments FOR ALL USING (true) WITH CHECK (true);


-- ════════════════════════════════════════════════════════════
-- 3. WHO PLACED THE ORDER
-- ════════════════════════════════════════════════════════════
-- Tag orders with the staff member who rang them in (null = the guest did).
ALTER TABLE orders ADD COLUMN IF NOT EXISTS placed_by TEXT;   -- server name / 'bar' / null


-- ════════════════════════════════════════════════════════════
-- 4. WALK-IN TABS (no table, identified by a name)
-- ════════════════════════════════════════════════════════════
-- A walk-in has no QR and no seat. The staff type the guest's name; the tab is
-- labelled with it everywhere — bar ticket, cashier list, receipt. The physical
-- "table_id" is a hidden slot so the money still has somewhere to live, but no
-- one ever reads it; they read the name.
ALTER TABLE table_tabs ADD COLUMN IF NOT EXISTS is_walkin  BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE table_tabs ADD COLUMN IF NOT EXISTS walkin_name TEXT;

-- Open a walk-in tab. Returns the new tab.
CREATE OR REPLACE FUNCTION open_walkin(p_name TEXT, p_by TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_slot TEXT;
  v_tab  table_tabs%ROWTYPE;
BEGIN
  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Please enter the guest''s name.');
  END IF;

  -- A hidden, unique slot so the one-live-tab-per-table index is satisfied.
  v_slot := 'WALKIN-' || to_char(NOW(),'YYYYMMDD') || '-' || nextval('table_tabs_id_seq');

  INSERT INTO table_tabs(table_id, status, total, is_walkin, walkin_name)
  VALUES (v_slot, 'open', 0, TRUE, btrim(p_name))
  RETURNING * INTO v_tab;

  RETURN jsonb_build_object('ok', true, 'tab', to_jsonb(v_tab));
END $$;
GRANT EXECUTE ON FUNCTION open_walkin(TEXT,TEXT) TO anon;

-- A readable label for any tab: the walk-in name, or the table id.
CREATE OR REPLACE FUNCTION tab_label(p_tab table_tabs)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN p_tab.is_walkin
              THEN COALESCE(p_tab.walkin_name,'Walk-in') || ' (walk-in)'
              ELSE p_tab.table_id END;
$$;


-- ── Verify ──────────────────────────────────────────────────
-- SELECT verify_staff_pin('server','444444');   -- true
-- SELECT verify_void_pin('000111');              -- true
-- SELECT open_walkin('Marco','bar');
