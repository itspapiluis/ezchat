-- ============================================================
-- EZChat · CLEAN SLATE — remove test data before going live
-- EasyCart Barcade & Lounge
--
-- WIPES:  receipts, orders, order items, tabs, discounts, voids,
--         chat messages, DMs, guests, alerts, staff activity
-- KEEPS:  menu items, menu categories, staff PINs, venue settings,
--         blocked words, announcements
--
-- Run this BEFORE phase7_production.sql.
-- ⚠️  THIS DELETES DATA AND CANNOT BE UNDONE.
--     Only run it if everything currently in the DB is test data.
-- ============================================================


-- ── STEP 1: Look before you leap ────────────────────────────
-- Run JUST this block first and read the output. If any number
-- looks like real business, STOP.

SELECT 'receipts (paid)' AS what, COUNT(*)::text AS rows,
       COALESCE(SUM(total),0)::text AS pesos
  FROM receipts WHERE status = 'paid'
UNION ALL SELECT 'tabs',        COUNT(*)::text, COALESCE(SUM(total),0)::text FROM table_tabs
UNION ALL SELECT 'orders',      COUNT(*)::text, '-' FROM orders
UNION ALL SELECT 'order_items', COUNT(*)::text, '-' FROM order_items
UNION ALL SELECT 'messages',    COUNT(*)::text, '-' FROM messages
UNION ALL SELECT 'guests',      COUNT(*)::text, '-' FROM users;


-- ── STEP 2: The wipe ────────────────────────────────────────
-- Each table is cleared independently. If a table doesn't exist
-- in your project, it is skipped instead of aborting the script.
-- RESTART IDENTITY resets the counters, so your first real
-- receipt is #1.

DO $$
DECLARE
  t TEXT;
  -- Order matters: children before parents.
  wipe TEXT[] := ARRAY[
    'discounts',
    'void_logs',
    'receipts',
    'order_items',
    'orders',
    'table_tabs',
    'direct_messages',
    'messages',
    'users',
    'admin_alerts',
    'staff_activity',
    'audit_logs'
  ];
BEGIN
  FOREACH t IN ARRAY wipe LOOP
    BEGIN
      EXECUTE format('TRUNCATE TABLE %I RESTART IDENTITY CASCADE', t);
      RAISE NOTICE 'cleared: %', t;
    EXCEPTION
      WHEN undefined_table THEN
        RAISE NOTICE 'skipped (no such table): %', t;
    END;
  END LOOP;
END $$;


-- ── STEP 3: Confirm it's empty ──────────────────────────────

SELECT 'receipts' AS what, COUNT(*) AS remaining FROM receipts
UNION ALL SELECT 'tabs',        COUNT(*) FROM table_tabs
UNION ALL SELECT 'orders',      COUNT(*) FROM orders
UNION ALL SELECT 'order_items', COUNT(*) FROM order_items
UNION ALL SELECT 'messages',    COUNT(*) FROM messages
UNION ALL SELECT 'guests',      COUNT(*) FROM users;
-- Everything should now read 0.


-- ── STEP 4: Confirm your MENU survived ──────────────────────
-- These must NOT be zero. If they are, something went wrong —
-- stop and tell Claude before opening.

SELECT 'menu_items'      AS what, COUNT(*) AS kept FROM menu_items
UNION ALL SELECT 'menu_categories', COUNT(*) FROM menu_categories
UNION ALL SELECT 'staff_config',    COUNT(*) FROM staff_config;
