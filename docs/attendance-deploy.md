# EZChat Attendance: deploy guide (Windows + Git + Vercel)

## What is in the ZIP (paths are relative to your repo root, `C:\Projects\ezchat`)

| File | New or changed |
|---|---|
| `src/attendance/ClockPage.jsx` | new, staff clock page (`/clock`) |
| `src/attendance/HRPage.jsx` | new, HR dashboard (`/hr`) |
| `src/attendance/hrClient.js` | new, separate Supabase client for HR only |
| `src/attendance/util.js` | new, helpers |
| `src/main.jsx` | **changed, 7 added lines only** (2 lazy imports + 2 routes) |
| `supabase/attendance.sql` | new, run once in Supabase |
| `supabase/attendance-rollback.sql` | new, undoes everything |
| `scripts/purge-old-selfies.mjs` | new, optional manual 90-day photo cleanup |
| `docs/attendance-deploy.md` | this file |

Not touched: `App.jsx`, `src/lib/supabase.js`, the staff PIN login, `vercel.json`, any existing table, policy or bucket.

## Existing-code review: risks and how they are handled

1. **Shared Supabase client has `persistSession:false`.** HR would be logged out on every refresh. Not changed. `/hr` uses its own client with its own storage key.
2. **A bug in new code could break the whole app.** The pages load with `React.lazy`, so they are only downloaded on `/clock` and `/hr`. Your main bundle is not affected. `xlsx` is its own chunk (about 143 KB gzipped) and only downloads when HR taps Export.
3. **Global CSS lives inside `App.jsx`.** The new pages use inline styles and their own full-screen background.
4. **One Supabase project, no staging.** The SQL is additive (`attendance_` prefix only). Rollback is provided.
5. **Push to `main` = production.** Work on a branch; Vercel builds a preview URL.
6. **Line endings.** Your `main.jsx` uses Windows (CRLF) endings. The delivered one does too, so `git diff` shows only the 7 added lines.

## Deploy steps

**1. New branch (PowerShell, in `C:\Projects\ezchat`)**
```
git checkout -b attendance
```

**2. Copy the files in.** Unzip the ZIP over the repo root. Windows will ask to replace `src\main.jsx`: yes.

**3. Check the change is only what is expected**
```
git status
git diff src/main.jsx
```
`git diff` must show only added lines (the lazy imports and the two `<Route>` lines). If it shows the whole file changed, stop and tell me.

**4. Install the one new dependency**
```
npm install xlsx
```

> `npm install xlsx` will make `npm audit` report vulnerabilities in `xlsx`. They apply to *reading* untrusted spreadsheets. This app only *writes* Excel files, so it is not exposed. Do not run `npm audit fix --force`.

**5. Database.** Supabase > SQL Editor > paste all of `supabase/attendance.sql` > Run. Then, in the same editor, run these with your real values:
```sql
update attendance_settings set bar_lat = 0.0000, bar_lng = 0.0000 where id = 1;
```
Get the numbers by right-clicking the bar in Google Maps and clicking the coordinates to copy them (first number = lat, second = lng).

**6. HR login.** Supabase > Authentication > Users > Add user (email + password, tick *Auto Confirm User*). Then run:
```sql
insert into attendance_hr (user_id) select id from auth.users where email = 'hr@example.com';
```
Repeat per HR person. Add your own email too if you want access to `/hr`.

**7. Test locally**
```
npm run dev
```
Use the checklist below. Note: the camera only works on `localhost` or HTTPS. For testing on a real phone use the Vercel preview URL (step 9).

**8. Build check**
```
npm run build
```
Must finish without errors.

**9. Push the branch and test on the preview URL**
```
git add .
git commit -m "Add attendance module (/clock, /hr)"
git push -u origin attendance
```
Vercel builds a preview URL for the branch (find it in the Vercel dashboard > Deployments). Test `/clock` on a real phone there.

**10. Go live.** When the checklist passes, merge `attendance` into `main` (GitHub pull request, or `git checkout main`, `git merge attendance`, `git push`).

**11. Give staff the link:** `https://ezchat-bar.vercel.app/clock`. Tell them to Add to Home Screen. HR link: `/hr`.

## Test checklist (do all of these before going live)

- [ ] `/` (guest chat), `/staff`, `/kitchen`, `/cashier` still work exactly as before.
- [ ] `/hr`: wrong password shows an error; correct login shows the dashboard; refresh keeps you logged in; Log out works.
- [ ] A login that is NOT in `attendance_hr` sees "no HR access".
- [ ] Staff tab: add a staff member with PIN `482915`. Adding PIN `123456` or `000000` is rejected. Adding a duplicate name asks for confirmation.
- [ ] `/clock` on a phone: staff name appears in the list; wrong PIN shows "Wrong PIN"; 5 wrong PINs locks for 10 minutes.
- [ ] Correct PIN opens the front camera with the live name / time / GPS / distance text; the browser asks for camera and location permission.
- [ ] Take photo: shows "Clocked IN" and "Photo saved".
- [ ] Open the saved photo in `/hr`: the text is burned into the image.
- [ ] Clock again within a minute: shows the cooldown message.
- [ ] Wait a minute, clock again: it is OUT, and the shift shows hours in `/hr`.
- [ ] Deny location permission and clock in: still works, shift shows "No GPS" flag.
- [ ] Clock in from home (or far from the bar): shows a red "N m from bar" flag.
- [ ] Forgotten clock-out: Fix button adds an HR entry with a required note; the original log stays.
- [ ] Export Excel opens with two sheets: Shifts and Raw logs.
- [ ] Fix form: entering a clock-out earlier than the clock-in is rejected with a clear message.
- [ ] Tap "Done" before the photo finishes saving: it asks for confirmation instead of silently dropping the photo.
- [ ] Shift past midnight (clock in at 11 PM, out at 3 AM) pairs into one shift dated by the clock-in day.

## Behaviour to know

- **If the photo says "did not upload" on first test:** the clock-in itself is still recorded, so nothing is lost, but tell me the exact message. This is the one part I could not test, because it depends on how Supabase Storage applies the upload policy.
- **Lockout can be abused.** Anyone who has the `/clock` link can type wrong PINs 5 times on a staff name and lock that person out for 10 minutes. HR clears it immediately by resetting that person's PIN (Staff tab). If it happens, keep the `/clock` link to staff only.
- **GPS accuracy.** Indoors, phones can report 50 to 300 m of error. The "m from bar" flag shows the accuracy next to the distance so HR can tell a real remote clock-in from a weak signal. After the first week, adjust `MAX_DISTANCE_M` in `src/attendance/util.js` if there are too many false flags.

- **Forgotten clock-out:** if the last log is an IN older than 14 hours, the next punch is a fresh IN (not an OUT), and the old shift shows "No clock-out" for HR to fix. A real shift longer than 14 hours would be misread, which is rare for a bar.
- **Timestamps** are the server's. The watermark time is the phone clock corrected to the server clock, and a "time mismatch" flag appears if they differ by over 2 minutes.
- **Known limit (client was told):** this is a deterrent plus an audit trail, not tamper-proof. Fake-GPS apps, holding up a photo of a photo, and sharing PINs are possible. HR must review flags and photos.
- **Privacy:** get written staff consent for selfie and GPS collection (Philippine Data Privacy Act). Optional 90-day photo cleanup: `scripts/purge-old-selfies.mjs` (dry run first, instructions inside).

## Rollback

1. Supabase > Storage > `attendance-selfies` > select all > Delete.
2. SQL Editor > run `supabase/attendance-rollback.sql`.
3. In git: `git revert` the merge commit (or delete the `attendance` branch if not merged).
