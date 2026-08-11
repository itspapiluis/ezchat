-- ============================================================================
-- PHASE 13 — Other Payables + Multi-Payment (monitoring, not a POS)
-- ============================================================================
-- Adds three capabilities to the cashier flow:
--   1. OTHER PAYABLES — arbitrary charges added to a bill (broken glass, CC fee),
--      fixed amount OR percentage, with a required reason. Mirror of discounts.
--   2. PAYMENT METHOD visibility — already stored on receipts.payment_method;
--      this migration just makes multi-method explicit (see #3).
--   3. MULTI-PAYMENT — a bill settled with more than one method
--      (e.g. cash 500 + gcash 300). Stored as a JSONB breakdown on the receipt.
--
-- This is a MONITORING system, not a cash register: it records HOW a bill was
-- settled. It does not make change. The recorded split must sum to the total.
--
-- Safe to run more than once (ADD COLUMN IF NOT EXISTS / CREATE OR REPLACE).
-- ============================================================================

-- ── 1. New receipt columns ──────────────────────────────────────────────────
-- payable_amt / payable_note : the "other payables" line (adds to total)
-- payment_breakdown          : JSONB array of {method, amount} for multi-pay.
--   For a single-method payment this holds one entry; payment_method still
--   carries a human summary so older code/reports keep working.
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS payable_amt       NUMERIC DEFAULT 0;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS payable_note      TEXT;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS payment_breakdown JSONB;

-- ── 2. pay_tab: accept payables + a payment breakdown ───────────────────────
-- Drop the previous 8-argument version so only ONE pay_tab exists. Postgres
-- identifies functions by their argument list, so adding parameters would
-- otherwise leave a stale 8-arg overload sitting alongside the new one.
DROP FUNCTION IF EXISTS pay_tab(BIGINT,JSONB,NUMERIC,NUMERIC,TEXT,NUMERIC,TEXT,TEXT);

-- New params are added at the END with defaults, so the function stays easy to
-- call. The client always passes all 11 now.
--   p_payable_amt   : amount added on top (already computed client-side from
--                     the fixed/percent toggle)
--   p_payable_note  : reason for the payable (required when amount > 0)
--   p_breakdown     : JSONB '[{"method":"cash","amount":500},...]' — the split.
--                     Server VALIDATES it sums to p_total (accurate records).
CREATE OR REPLACE FUNCTION pay_tab(
  p_tab_id         BIGINT,
  p_items          JSONB,
  p_subtotal       NUMERIC,
  p_discount_amt   NUMERIC,
  p_discount_note  TEXT,
  p_total          NUMERIC,
  p_payment_method TEXT,
  p_payment_ref    TEXT,
  p_payable_amt    NUMERIC DEFAULT 0,
  p_payable_note   TEXT    DEFAULT NULL,
  p_breakdown      JSONB   DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tab       table_tabs%ROWTYPE;
  v_receipt   receipts%ROWTYPE;
  v_sum       NUMERIC;
BEGIN
  SELECT * INTO v_tab FROM table_tabs WHERE id = p_tab_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Tab not found.');
  END IF;
  IF v_tab.status = 'closed' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This tab is already closed.');
  END IF;

  -- Validate the multi-payment split sums to the total (monitoring accuracy).
  -- A NULL breakdown means a plain single-method payment — nothing to check.
  IF p_breakdown IS NOT NULL THEN
    SELECT COALESCE(SUM((e->>'amount')::NUMERIC), 0) INTO v_sum
      FROM jsonb_array_elements(p_breakdown) e;
    -- allow a 1-centavo rounding tolerance
    IF ABS(v_sum - p_total) > 0.01 THEN
      RETURN jsonb_build_object('ok', false,
        'error', 'Payment split (' || v_sum || ') does not match the total (' || p_total || ').');
    END IF;
  END IF;

  -- Self-heal: everything already paid → just close (unchanged behavior).
  SELECT * INTO v_receipt
    FROM receipts WHERE tab_id = p_tab_id AND status = 'paid' LIMIT 1;
  IF FOUND AND NOT EXISTS (
       SELECT 1 FROM order_items
        WHERE tab_id = p_tab_id AND NOT voided AND paid_receipt_id IS NULL
     ) THEN
    UPDATE table_tabs
       SET status='closed', closed_at=COALESCE(closed_at,NOW()), receipt_id=v_receipt.id
     WHERE id = p_tab_id;
    RETURN jsonb_build_object('ok', true, 'recovered', true, 'receipt', to_jsonb(v_receipt));
  END IF;

  INSERT INTO receipts(
    tab_id, table_id, items, subtotal, discount_amt, discount_note,
    payable_amt, payable_note, payment_breakdown,
    total, payment_method, payment_ref, issued_by, status
  ) VALUES (
    p_tab_id, v_tab.table_id, p_items, p_subtotal, p_discount_amt, p_discount_note,
    COALESCE(p_payable_amt,0), NULLIF(p_payable_note,''), p_breakdown,
    p_total, p_payment_method, NULLIF(p_payment_ref,''), 'cashier', 'paid'
  )
  RETURNING * INTO v_receipt;

  UPDATE order_items
     SET paid_receipt_id = v_receipt.id
   WHERE tab_id = p_tab_id AND NOT voided AND paid_receipt_id IS NULL;

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

-- Grant for BOTH the old and new signatures (Postgres treats them as distinct).
GRANT EXECUTE ON FUNCTION pay_tab(BIGINT,JSONB,NUMERIC,NUMERIC,TEXT,NUMERIC,TEXT,TEXT,NUMERIC,TEXT,JSONB) TO anon;

-- ============================================================================
-- Done. Client passes payable_amt/note (from the fixed/percent toggle) and a
-- payment_breakdown array. Reports can read payment_method or payment_breakdown.
-- ============================================================================
