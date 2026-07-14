-- ============================================================
-- EZChat · PHASE 9 — WHAT A BAR ACTUALLY NEEDS NIGHTLY
-- Run in Supabase SQL Editor. Safe to re-run.
-- ============================================================
--   1. Split the bill   (pay part of a tab; the rest stays open)
--   2. Move a tab       (guests change tables)
--   3. Daily summary    (the end-of-night number)
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- 1. SPLIT THE BILL
-- ════════════════════════════════════════════════════════════
-- Two friends, one tab. Extremely common, and currently impossible.
--
-- We tag each item with the receipt that paid for it. A tab can then be paid
-- across SEVERAL receipts. The tab closes only when every live item is paid.

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS paid_receipt_id BIGINT REFERENCES receipts(id);

CREATE INDEX IF NOT EXISTS idx_order_items_unpaid
  ON order_items(tab_id) WHERE paid_receipt_id IS NULL AND NOT voided;

-- Backfill: everything on an already-closed tab counts as paid.
UPDATE order_items oi
   SET paid_receipt_id = t.receipt_id
  FROM table_tabs t
 WHERE oi.tab_id = t.id
   AND t.status = 'closed'
   AND t.receipt_id IS NOT NULL
   AND oi.paid_receipt_id IS NULL;


-- Pay for SPECIFIC items. Returns the receipt + whether the tab is now settled.
CREATE OR REPLACE FUNCTION pay_tab_partial(
  p_tab_id         BIGINT,
  p_item_ids       BIGINT[],
  p_discount_amt   NUMERIC,
  p_discount_note  TEXT,
  p_payment_method TEXT,
  p_payment_ref    TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tab       table_tabs%ROWTYPE;
  v_receipt   receipts%ROWTYPE;
  v_items     JSONB;
  v_subtotal  NUMERIC;
  v_total     NUMERIC;
  v_remaining INT;
BEGIN
  SELECT * INTO v_tab FROM table_tabs WHERE id = p_tab_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Tab not found.');
  END IF;
  IF v_tab.status = 'closed' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This tab is already closed.');
  END IF;

  -- Only unpaid, unvoided items on THIS tab can be settled.
  SELECT COALESCE(SUM(subtotal),0),
         COALESCE(jsonb_agg(jsonb_build_object(
           'name', item_name, 'qty', quantity,
           'price', item_price, 'subtotal', subtotal,
           'category', category_type, 'status', status
         )), '[]'::jsonb)
    INTO v_subtotal, v_items
    FROM order_items
   WHERE tab_id = p_tab_id
     AND id = ANY(p_item_ids)
     AND NOT voided
     AND paid_receipt_id IS NULL;

  IF v_subtotal <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Those items are already paid, or none were selected.');
  END IF;

  v_total := GREATEST(0, ROUND(v_subtotal - COALESCE(p_discount_amt,0), 2));

  INSERT INTO receipts(
    tab_id, table_id, items, subtotal, discount_amt, discount_note,
    total, payment_method, payment_ref, issued_by, status
  ) VALUES (
    p_tab_id, v_tab.table_id, v_items, v_subtotal, COALESCE(p_discount_amt,0), p_discount_note,
    v_total, p_payment_method, NULLIF(p_payment_ref,''), 'cashier', 'paid'
  )
  RETURNING * INTO v_receipt;

  UPDATE order_items
     SET paid_receipt_id = v_receipt.id
   WHERE tab_id = p_tab_id
     AND id = ANY(p_item_ids)
     AND NOT voided
     AND paid_receipt_id IS NULL;

  -- Anything left to pay on this tab?
  SELECT COUNT(*) INTO v_remaining
    FROM order_items
   WHERE tab_id = p_tab_id AND NOT voided AND paid_receipt_id IS NULL;

  IF v_remaining = 0 THEN
    -- BUGFIX: a split tab is settled by SEVERAL receipts. The tab's stored total
    -- must be everything collected on it, not just the last payment — otherwise
    -- the cashier's "Closed" list understates every split bill.
    UPDATE table_tabs
       SET status = 'closed', closed_at = NOW(),
           receipt_id = v_receipt.id, closed_by = 'cashier',
           total = COALESCE((
             SELECT SUM(total) FROM receipts
              WHERE tab_id = p_tab_id AND status = 'paid'), 0)
     WHERE id = p_tab_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'receipt', to_jsonb(v_receipt),
    'remaining_items', v_remaining,
    'tab_closed', (v_remaining = 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION pay_tab_partial(BIGINT,BIGINT[],NUMERIC,TEXT,TEXT,TEXT) TO anon;


-- pay_tab() must ignore items that were already paid in a split.
CREATE OR REPLACE FUNCTION pay_tab(
  p_tab_id         BIGINT,
  p_items          JSONB,
  p_subtotal       NUMERIC,
  p_discount_amt   NUMERIC,
  p_discount_note  TEXT,
  p_total          NUMERIC,
  p_payment_method TEXT,
  p_payment_ref    TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tab     table_tabs%ROWTYPE;
  v_receipt receipts%ROWTYPE;
BEGIN
  SELECT * INTO v_tab FROM table_tabs WHERE id = p_tab_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Tab not found.');
  END IF;
  IF v_tab.status = 'closed' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This tab is already closed.');
  END IF;

  SELECT * INTO v_receipt
    FROM receipts WHERE tab_id = p_tab_id AND status = 'paid' LIMIT 1;

  IF FOUND AND NOT EXISTS (
       SELECT 1 FROM order_items
        WHERE tab_id = p_tab_id AND NOT voided AND paid_receipt_id IS NULL
     ) THEN
    -- Everything is already paid; just close the tab (self-heal).
    UPDATE table_tabs
       SET status='closed', closed_at=COALESCE(closed_at,NOW()),
           receipt_id=v_receipt.id
     WHERE id = p_tab_id;
    RETURN jsonb_build_object('ok', true, 'recovered', true, 'receipt', to_jsonb(v_receipt));
  END IF;

  INSERT INTO receipts(
    tab_id, table_id, items, subtotal, discount_amt, discount_note,
    total, payment_method, payment_ref, issued_by, status
  ) VALUES (
    p_tab_id, v_tab.table_id, p_items, p_subtotal, p_discount_amt, p_discount_note,
    p_total, p_payment_method, NULLIF(p_payment_ref,''), 'cashier', 'paid'
  )
  RETURNING * INTO v_receipt;

  -- Mark every remaining unpaid item as settled by this receipt.
  UPDATE order_items
     SET paid_receipt_id = v_receipt.id
   WHERE tab_id = p_tab_id AND NOT voided AND paid_receipt_id IS NULL;

  -- BUGFIX: total must be EVERYTHING collected on this tab (a split tab has
  -- more than one receipt), not just this final payment.
  UPDATE table_tabs
     SET status='closed', closed_at=NOW(),
         receipt_id=v_receipt.id, closed_by='cashier',
         total = COALESCE((
           SELECT SUM(total) FROM receipts
            WHERE tab_id = p_tab_id AND status = 'paid'), 0)
   WHERE id = p_tab_id;

  RETURN jsonb_build_object('ok', true, 'receipt', to_jsonb(v_receipt));
END;
$$;

GRANT EXECUTE ON FUNCTION pay_tab(BIGINT,JSONB,NUMERIC,NUMERIC,TEXT,NUMERIC,TEXT,TEXT) TO anon;


-- ════════════════════════════════════════════════════════════
-- 2. MOVE A TAB TO ANOTHER TABLE
-- ════════════════════════════════════════════════════════════
-- Guests change seats. The bill should follow them.

CREATE OR REPLACE FUNCTION move_tab(p_tab_id BIGINT, p_new_table TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tab table_tabs%ROWTYPE;
BEGIN
  SELECT * INTO v_tab FROM table_tabs WHERE id = p_tab_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Tab not found.');
  END IF;
  IF v_tab.status = 'closed' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Cannot move a closed tab.');
  END IF;
  IF v_tab.table_id = p_new_table THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That tab is already at this table.');
  END IF;

  -- The destination must be free (only one live tab per table).
  IF EXISTS (
    SELECT 1 FROM table_tabs
     WHERE table_id = p_new_table
       AND status IN ('open','bill_requested')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That table already has an open tab.');
  END IF;

  UPDATE table_tabs SET table_id = p_new_table WHERE id = p_tab_id;
  UPDATE orders      SET table_id = p_new_table WHERE tab_id = p_tab_id;
  UPDATE order_items SET table_id = p_new_table WHERE tab_id = p_tab_id;

  INSERT INTO audit_logs(action, entity, entity_id, details, performed_by)
  VALUES ('tab_moved','table_tabs',p_tab_id::text,
          jsonb_build_object('from',v_tab.table_id,'to',p_new_table),'cashier');

  RETURN jsonb_build_object('ok', true, 'from', v_tab.table_id, 'to', p_new_table);
END;
$$;

GRANT EXECUTE ON FUNCTION move_tab(BIGINT,TEXT) TO anon;


-- ════════════════════════════════════════════════════════════
-- 3. DAILY SUMMARY (the Z-report)
-- ════════════════════════════════════════════════════════════
-- One honest number for the end of the night: what came in, how, and what
-- was given away or voided.

CREATE OR REPLACE FUNCTION daily_summary(p_date DATE)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from TIMESTAMPTZ := p_date::timestamptz;
  v_to   TIMESTAMPTZ := (p_date + 1)::timestamptz;
  v_out  JSONB;
BEGIN
  SELECT jsonb_build_object(
    'date', p_date,

    'gross',      COALESCE((SELECT SUM(subtotal)     FROM receipts WHERE status='paid' AND issued_at >= v_from AND issued_at < v_to),0),
    'discounts',  COALESCE((SELECT SUM(discount_amt) FROM receipts WHERE status='paid' AND issued_at >= v_from AND issued_at < v_to),0),
    'net',        COALESCE((SELECT SUM(total)        FROM receipts WHERE status='paid' AND issued_at >= v_from AND issued_at < v_to),0),
    'receipts',   COALESCE((SELECT COUNT(*)          FROM receipts WHERE status='paid' AND issued_at >= v_from AND issued_at < v_to),0),

    'avg_receipt', COALESCE((
      SELECT ROUND(AVG(total),2) FROM receipts
       WHERE status='paid' AND issued_at >= v_from AND issued_at < v_to),0),

    'by_payment', COALESCE((
      SELECT jsonb_object_agg(payment_method, amt) FROM (
        SELECT payment_method, SUM(total) AS amt
          FROM receipts
         WHERE status='paid' AND issued_at >= v_from AND issued_at < v_to
         GROUP BY payment_method
      ) x), '{}'::jsonb),

    'voided_amount', COALESCE((
      SELECT SUM(oi.subtotal) FROM order_items oi
       WHERE oi.voided AND oi.voided_at >= v_from AND oi.voided_at < v_to),0),
    'voided_items', COALESCE((
      SELECT COUNT(*) FROM order_items oi
       WHERE oi.voided AND oi.voided_at >= v_from AND oi.voided_at < v_to),0),

    'tabs_opened', COALESCE((
      SELECT COUNT(*) FROM table_tabs
       WHERE opened_at >= v_from AND opened_at < v_to),0),

    -- BUGFIX: this used to join on tab_id. A SPLIT bill produces TWO receipts for
    -- one tab, so every item matched BOTH receipts and the quantities doubled.
    -- Join on the receipt that actually paid for the item instead.
    'top_items', COALESCE((
      SELECT jsonb_agg(t) FROM (
        SELECT oi.item_name AS name,
               SUM(oi.quantity) AS qty,
               SUM(oi.subtotal) AS revenue
          FROM order_items oi
          JOIN receipts r ON r.id = oi.paid_receipt_id AND r.status = 'paid'
         WHERE NOT oi.voided
           AND r.issued_at >= v_from AND r.issued_at < v_to
         GROUP BY oi.item_name
         ORDER BY SUM(oi.quantity) DESC
         LIMIT 10
      ) t), '[]'::jsonb)
  ) INTO v_out;

  RETURN v_out;
END;
$$;

GRANT EXECUTE ON FUNCTION daily_summary(DATE) TO anon;


-- ── Verify ──────────────────────────────────────────────────
-- SELECT daily_summary(CURRENT_DATE);
