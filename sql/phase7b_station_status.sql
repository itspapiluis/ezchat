-- ============================================================
-- EZChat · PHASE 7b — PER-STATION ORDER STATUS
-- EasyCart Barcade & Lounge
-- Run AFTER phase7_production.sql. Safe to re-run.
-- ============================================================
--
-- THE BUG THIS FIXES
-- ------------------
-- One order can contain food AND drinks, but there is only ONE row in
-- `orders`. Kitchen and Bar were BOTH writing `orders.status` directly:
--
--     UPDATE orders SET status = 'ready' WHERE id = ...
--
-- So when the kitchen marked the burger ready, the bar's beer ALSO flipped
-- to "Ready" — before anyone had poured it.
--
-- Worse, on a void:
--     Kitchen voids only the FOOD items  ✓
--     ...then marks the WHOLE ORDER voided  ✗
-- The beer vanished from the Bar screen but was still billed to the guest.
--
-- THE FIX
-- -------
-- `order_items.status` is already per-item and per-station. That is the truth.
-- `orders.status` becomes a READ-ONLY ROLLUP, computed by the database:
--
--   * least-advanced non-voided item wins
--     (so the order is only 'ready' when EVERY station is ready)
--   * every item voided  → order is 'voided'
--
-- Kitchen and Bar now only ever touch their OWN items. They cannot
-- overwrite each other, because they no longer write to `orders` at all.
-- ============================================================


CREATE OR REPLACE FUNCTION recalc_order_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order  BIGINT;
  v_live   INT;
  v_total  INT;
  v_status TEXT;
BEGIN
  v_order := COALESCE(NEW.order_id, OLD.order_id);
  IF v_order IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COUNT(*) FILTER (WHERE NOT voided), COUNT(*)
    INTO v_live, v_total
    FROM order_items
   WHERE order_id = v_order;

  IF v_total = 0 THEN
    RETURN COALESCE(NEW, OLD);           -- no items; leave the order alone
  END IF;

  IF v_live = 0 THEN
    v_status := 'voided';                -- every station voided its items
  ELSE
    -- The least-advanced live item decides the order's status.
    -- pending < preparing < ready < served
    SELECT CASE MIN(
             CASE status
               WHEN 'pending'   THEN 1
               WHEN 'preparing' THEN 2
               WHEN 'ready'     THEN 3
               WHEN 'served'    THEN 4
               ELSE 1
             END)
           WHEN 1 THEN 'pending'
           WHEN 2 THEN 'preparing'
           WHEN 3 THEN 'ready'
           WHEN 4 THEN 'served'
           END
      INTO v_status
      FROM order_items
     WHERE order_id = v_order
       AND NOT voided;
  END IF;

  UPDATE orders
     SET status     = v_status,
         updated_at = NOW()
   WHERE id = v_order
     AND status IS DISTINCT FROM v_status;   -- avoid pointless realtime churn

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_recalc_order_status ON order_items;
CREATE TRIGGER trg_recalc_order_status
AFTER INSERT OR UPDATE OR DELETE ON order_items
FOR EACH ROW EXECUTE FUNCTION recalc_order_status();


-- ── Repair any orders whose status already drifted ──────────
UPDATE orders o
   SET status = sub.correct
  FROM (
    SELECT oi.order_id,
           CASE
             WHEN COUNT(*) FILTER (WHERE NOT oi.voided) = 0 THEN 'voided'
             ELSE CASE MIN(
                    CASE oi.status
                      WHEN 'pending'   THEN 1
                      WHEN 'preparing' THEN 2
                      WHEN 'ready'     THEN 3
                      WHEN 'served'    THEN 4
                      ELSE 1
                    END) FILTER (WHERE NOT oi.voided)
                  WHEN 1 THEN 'pending'
                  WHEN 2 THEN 'preparing'
                  WHEN 3 THEN 'ready'
                  WHEN 4 THEN 'served'
                  END
           END AS correct
      FROM order_items oi
     GROUP BY oi.order_id
  ) sub
 WHERE o.id = sub.order_id
   AND sub.correct IS NOT NULL
   AND o.status IS DISTINCT FROM sub.correct;


-- ── Verify ──────────────────────────────────────────────────
-- Are your menu categories actually tagged food / drinks / spirits?
-- Anything else appears on NEITHER station screen and is never made.
--   SELECT category_type, COUNT(*) FROM order_items GROUP BY category_type;
--   SELECT DISTINCT category_type FROM menu_items;
