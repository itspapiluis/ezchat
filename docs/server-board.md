# Server board (Admin > Staff tab)

Replaces the plain "Server names" list with a board:
- Each server shows On duty (clocked in via attendance, with the time) / Not clocked in / No HR account / off.
- Admin taps "Edit tables" on a server, then taps tables to add or remove them. Tapping a table that
  another server covers asks first, then MOVES it.
- "Tables without a server" list with quick-assign (on-duty servers first).
- Servers still choose their own tables on their own screen. Both write to the same assignments.
- A server who is not clocked in but still holds tables is flagged.

## Deploy
1. Supabase > SQL Editor > run `supabase/server-duty.sql` (read-only, adds one function). Undo: `server-duty-rollback.sql`.
   Without it the board still works, it just hides the On duty labels.
2. Push the code. Files: `src/staff/ServerBoard.jsx` (new), `src/staff/Reports.jsx` (one import, old block replaced).

## Notes
- A server's own screen loads their tables when it opens, so an admin change shows there after they reopen it.
- Removing a server deletes their assignments too. "Turn off" keeps everything.
