# Table reservations: deploy steps

Online table booking inside EZChat. Free, no deposit. Hidden from guests until you switch it ON.

## 1. Branch
```
git status
git checkout -b reservations
```
(Run `git status` first. If `attendance-gate` is not merged to main yet, branch from it.)

## 2. Build check
```
npm run build
```

## 3. Database
Supabase > SQL Editor > paste `supabase/reservations.sql` > Run.
Safe to re-run. The feature stays OFF. Undo (deletes bookings): `supabase/reservations-rollback.sql`.

## 4. Push and test on the Vercel preview
```
git add -A
git commit -m "Add table reservations"
git push -u origin reservations
```
Open `/?admin=1` > Reservations > Turn ON, then try `/?reserve=1` on your phone.

## 5. Go live
Merge to main. Point Facebook / QR links to `ezchat-bar.vercel.app/?reserve=1`.

## Rules (enforced by the database)
- Book from today to the last day of this month. Arrival 6:00 PM to 10:30 PM, every 30 minutes.
- Table held 30 minutes after the reserved time, then it is released. Staff marking "Arrived" keeps it.
- One active booking per table per date. Max 2 active bookings per phone number.
- Guests cancel or look up with booking code + last 4 digits of their phone.
- Prices are consumable amounts. KTV: 3,500 for the first 3 hours + 350 per extra hour.

## Please confirm
- KTV room capacity is set to 15 (placeholder). Edit in table `reservation_tables`.
- Old-site bookings must be re-entered by hand (Admin > Reservations > + New booking).
- 32 tables in total (not 31).
