# Attendance gate: everybody clocks in to use their staff screen

## What it does

When the gate is ON, nobody can use the Kitchen, Bar, Cashier or Server screen until they have signed in with **their own name and personal PIN**.

- **Not clocked in yet:** the selfie clock-in appears right there, then the screen opens.
- **Already clocked in** (for example from `/clock` on their phone): they sign in and go straight to the screen, with no second selfie.
- **Server screen:** it already knows who is serving, so the old name picker and the "Switch" button are gone. Table assignments keep working under that name.
- **End shift:** a small button with the person's name sits in the bottom-left corner. It opens "End shift" (PIN, then selfie clock-out). If they still have open tables, it warns first but does not block.
- **Switching people on a shared tablet:** the next person taps the corner button, then "Not me". That does **not** clock the first person out, so they should tap End shift first, or clock out on `/clock`.

## Safety design

- **Off by default.** Deploying the code changes nothing for staff until you run the one SQL line that turns it on. Turn it off the same way, instantly, with no redeploy.
- **Fails open.** If the database can't be reached, a request hangs for more than 5 seconds, or the gate file fails to download, the staff screen opens normally. A gate problem can never lock the kitchen.
- **Existing files:** Kitchen, Bar, Cashier, StaffLogin, `shared.js`, `App.jsx` and the main Supabase client are **not changed**. Only `main.jsx` (+19/-1 lines) and `Server.jsx` (+2/-1 lines) are edited.
- **Admin** (`/?admin=1`) is not gated.

## Files

| File | Status |
|---|---|
| `src/attendance/AttendanceGate.jsx` | new |
| `src/attendance/session.js` | new |
| `src/attendance/ClockPage.jsx` | changed (adds optional gate/end modes; `/clock` itself behaves as before) |
| `src/attendance/HRPage.jsx` | changed (one hint line in the Staff tab) |
| `src/main.jsx` | changed (+19/-1) |
| `src/staff/Server.jsx` | changed (+2/-1) |
| `supabase/attendance-gate.sql` | new (additive, safe to re-run) |
| `supabase/attendance-gate-rollback.sql` | new |
| `docs/attendance-gate-deploy.md` | this file |

## Deploy steps (PowerShell, in `C:\Projects\ezchat`, branch `attendance-gate`)

**1. Check what changed**
```
git status
git diff --stat
git diff src/main.jsx src/staff/Server.jsx
```
Only the files in the table above may appear. If Kitchen, Bar, Cashier or `App.jsx` appears, stop.

**2. Build**
```
npm run build
```
It must end with "built in". No new packages are needed.

**3. Database.** Supabase, SQL Editor, new query, paste `supabase/attendance-gate.sql`, Run. Expect "Success. No rows returned". The gate is still OFF.

**4. Make sure EVERY person has an account.** Open `/hr`, Staff tab, and add everyone who works at the bar (kitchen, bar, cashier, servers, and yourself if you use these screens), each with a name and a 6-digit PIN.
- Servers: type the name **exactly** as it appears in your Server list.
- Check for mismatches in Supabase. Any server who appears in this result will not get their tables linked:
```sql
select s.name from attendance_staff s
 where s.active and not exists
   (select 1 from servers v where lower(trim(v.name)) = lower(trim(s.name)));
```
People who only use Kitchen, Bar or Cashier will also show up here. That is fine.

**5. Push the branch and get a preview address**
```
git add .
git commit -m "Attendance gate: staff sign in and clock in to use their screens"
git push -u origin attendance-gate
```
Vercel, Deployments: the top row for branch `attendance-gate` gives you a preview address.

**6. Test on the preview address (the live site has no gate code yet, so it is safe)**
1. Turn the gate on: `update attendance_settings set gate_enabled = true where id = 1;`
2. Open `<preview address>/kitchen` on a phone or tablet. (If asked for the role PIN, enter it.) You should see "Clock in to start your shift".
3. Sign in with a test person, take the selfie, and confirm the Kitchen screen opens with the person's name in the bottom-left.
4. Tap the name, then End shift, enter the PIN, take the selfie. You should land on the role picker.
5. Test `/server`: sign in, and confirm "Signed in as <name>" with no Switch button, and that "My Tables" works.
6. Check `/hr` shows both punches with photos.
7. If testing during service, turn the gate off again afterward: `update attendance_settings set gate_enabled = false where id = 1;`

**7. Go live.** When the preview passes, merge `attendance-gate` into `main` (as before). Then pick a quiet time, brief the staff, and turn the gate on.

## Rollback (each step is independent)

1. **Instant:** `update attendance_settings set gate_enabled = false where id = 1;`
2. **Code:** `git revert` the commit and push.
3. **Database:** run `supabase/attendance-gate-rollback.sql`. It removes only the gate. The clock-in module and all logs stay.

## Things to know

- **Shared tablets:** a person stays signed in on a tablet until End shift or "Not me". If the previous person forgot to end their shift, their shift stays open for HR to fix in the Shifts tab.
- **A shift past 14 hours** stops counting. The next time the screen checks (on load, when the tab comes back into view, and every 5 minutes), that person is asked to clock in again.
- **No internet when the screen loads:** it opens normally and nobody is asked to clock in. They can clock in on `/clock` once the connection is back.
- **GPS on tablets** is often weak or missing. Expect "No GPS" or large "m from bar" flags on fixed tablets, and judge them in HR.
- **Honest limit:** the gate remembers who is signed in on the device (a name, never a PIN). Anyone with the role PIN and some technical skill could pretend to be a colleague who is currently clocked in. The attendance record itself stays accurate, because clock-in and clock-out always need the person's own PIN. This is a deterrent plus audit trail, like the rest of the module.
- **The "open tables" warning** uses the tables on the server's "My Tables" list that still have an open or bill-requested tab. If the warning ever can't be worked out, it shows nothing and never blocks.
