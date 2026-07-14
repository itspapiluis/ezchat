-- ============================================================
-- EZChat · PHASE 10 — TABLE HANDOVER
-- Run in Supabase SQL Editor. Safe to re-run.
-- ============================================================
--
-- THE PROBLEM
-- -----------
-- The QR code on table C4 is just a URL: ?table=C4. It is a BEARER TOKEN.
-- Anyone who scans it, screenshots it, or bookmarks it is "at table C4"
-- forever — including a guest who paid, went home, and still has the page open.
-- Their next order would land on whoever is sitting at C4 now.
--
-- WHY WE DON'T JUST CUT THEM OFF WHEN THEY PAY
-- --------------------------------------------
-- Because a table that pays and orders another round is the NORMAL case.
-- Forcing a re-scan for every round would be miserable. The guest should be
-- able to keep ordering all night.
--
-- THE ACTUAL SIGNAL
-- -----------------
-- The moment that matters is not "they paid" — it is "they LEFT". Only staff
-- know that. They are the ones clearing the glasses.
--
-- So: every table carries an "epoch". A guest's phone remembers the epoch it
-- scanned. Staff tap CLOSE TABLE when the guests get up → the epoch bumps →
-- every phone still holding the old epoch is locked out and must re-scan.
--
--   Pay + New Round  → epoch UNCHANGED → guest keeps ordering, zero friction
--   Close Table      → epoch BUMPED    → old phones dead, new group gets a clean slate
-- ============================================================


CREATE TABLE IF NOT EXISTS table_sessions (
  table_id   TEXT PRIMARY KEY,
  epoch      BIGINT      NOT NULL DEFAULT 1,
  closed_at  TIMESTAMPTZ,
  closed_by  TEXT
);

ALTER TABLE table_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone can read table sessions" ON table_sessions;
CREATE POLICY "anyone can read table sessions" ON table_sessions
  FOR SELECT USING (true);
-- Writes happen only through close_table() below.

-- Seed every table at epoch 1.
INSERT INTO table_sessions(table_id)
SELECT unnest(ARRAY[
  'L1','L2','L3',
  'R1','R2','R3','R4',
  'C1','C2','C3','C4',
  'D1','D2','D3','D4','D5',
  'B1','B2','B3','B4','B5','B6','B7',
  'M1',
  'F1','F2','F3',
  'KTV ROOM 1','KTV ROOM 2',
  'SAPPHIRE','RUBY','DIAMOND'
])
ON CONFLICT (table_id) DO NOTHING;


-- ── CLOSE TABLE ─────────────────────────────────────────────
-- The guests got up and left. Settle whatever is open, then bump the epoch so
-- their phones can no longer reach this table.
CREATE OR REPLACE FUNCTION close_table(p_table_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_unpaid NUMERIC;
  v_epoch  BIGINT;
BEGIN
  -- Refuse to close a table that still owes money — that would be walking a bill.
  SELECT COALESCE(SUM(oi.subtotal),0) INTO v_unpaid
    FROM order_items oi
    JOIN table_tabs t ON t.id = oi.tab_id
   WHERE t.table_id = p_table_id
     AND t.status IN ('open','bill_requested')
     AND NOT oi.voided
     AND oi.paid_receipt_id IS NULL;

  IF v_unpaid > 0 THEN
    RETURN jsonb_build_object('ok', false,
      'error', 'This table still owes ' || v_unpaid || '. Take payment (or void the items) before closing it.');
  END IF;

  -- Close any lingering empty tab.
  UPDATE table_tabs
     SET status = 'closed', closed_at = NOW(), closed_by = 'cashier'
   WHERE table_id = p_table_id
     AND status IN ('open','bill_requested');

  -- Bump the epoch: every phone still holding the old one is now locked out.
  INSERT INTO table_sessions(table_id, epoch, closed_at, closed_by)
  VALUES (p_table_id, 2, NOW(), 'cashier')
  ON CONFLICT (table_id) DO UPDATE
     SET epoch     = table_sessions.epoch + 1,
         closed_at = NOW(),
         closed_by = 'cashier'
  RETURNING epoch INTO v_epoch;

  INSERT INTO audit_logs(action, entity, entity_id, details, performed_by)
  VALUES ('table_closed','table_sessions',p_table_id,
          jsonb_build_object('new_epoch', v_epoch),'cashier');

  RETURN jsonb_build_object('ok', true, 'epoch', v_epoch);
END;
$$;

GRANT EXECUTE ON FUNCTION close_table(TEXT) TO anon;


-- ── Verify ──────────────────────────────────────────────────
-- SELECT * FROM table_sessions ORDER BY table_id;
-- SELECT close_table('C4');
