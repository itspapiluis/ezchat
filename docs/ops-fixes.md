# Ops fixes

## Cashier (src/staff/Cashier.jsx)
- New Round only on the table's LATEST bill (not on old bills of groups that left).
- New Round on a closed WALK-IN keeps the walk-in name (no more ghost "WALKIN-..." tab).
- If the table was closed after the bill was paid, New Round explains the guests have left.
- If a guest's phone starts the round at the same moment, the cashier opens that tab instead of an error.
- Payment prompt: "Guests staying - keep table open (new round)" is now the main button.
  "Guests left - Close Table" is smaller and asks for confirmation first.
- Why a guest's phone says "This table has been closed": someone pressed Close Table (it locks old phones). The guest must re-scan the QR code.

## HR: delete a staff account (src/attendance/HRPage.jsx + supabase/attendance-delete.sql)
- Delete button on each staff row. Run attendance-delete.sql in Supabase first.
- No attendance records: asks once, then deletes.
- Has records: asks again and you must type DELETE to remove the account AND its records. Cancel and use Deactivate to keep the history.
- A matching server is only hidden (never deleted) so table assignments stay intact. Selfie files stay in storage.
- Undo the SQL: attendance-delete-rollback.sql (removes only the function).
