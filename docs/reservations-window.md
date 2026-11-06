# Open bookings past month end + auto-cancel warning

## What changed
1. Admin > Reservations has a new card "Guests can book until".
   - Default = last day of this month (same as before).
   - "Open all of next month" (one click, asks to confirm), or pick any date and Save.
   - Reset puts it back to month end. It can only be stretched, never shortened below month end.
   - Limit: from today up to one year ahead.
2. When Auto-release is ON, a red warning "LATE = AUTO-CANCELLED" shows to guests:
   - top of the booking form, the confirm sheet (with the exact release time, e.g. 9:00 PM -> 9:30 PM),
     the success screen, and My booking.
   - In Admin "New booking" (staff/marketing entering a booking) there is a matching warning.
   - When Auto-release is OFF none of these show; the "please arrive on time" note stays.

## Install (in this order)
1. Supabase SQL Editor: run `supabase\reservations-window.sql`
   (needs `supabase\reservations.sql` to have been run already; safe to run twice).
2. Copy into `C:\Projects\ezchat\src\reservations\`: api.js, AdminReservations.jsx, ReservePanel.jsx
3. PowerShell:
   npm run build
   git add -A
   git commit -m "Open bookings until date, auto-cancel warning"
   git push

## Open December
Admin > Reservations > "Open all of next month" (while still in November), or pick Dec 31 and Save.
Booked December tables stay booked after Reset; Reset only stops NEW bookings past month end.

## Undo
Admin: press Reset. Or SQL: update reservation_settings set open_until = null where id = 1;
