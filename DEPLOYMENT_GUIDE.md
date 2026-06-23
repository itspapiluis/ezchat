# EZChat — Full Deployment Guide
### EasyCart Barcade & Lounge · Catarman, Northern Samar
### 100% Free · React + Supabase + Vercel

---

## YOUR PROJECT FILE STRUCTURE

```
ezchat/
├── public/
│   └── favicon.svg
├── src/
│   ├── App.jsx               ← Full EZChat app with Supabase
│   └── main.jsx              ← React entry point
├── .env.example              ← Template for your secret keys
├── .env                      ← YOUR actual keys (never commit this)
├── .gitignore
├── index.html
├── package.json
├── supabase_schema.sql       ← Run this in Supabase to create tables
├── vercel.json
└── vite.config.js
```

---

## WHAT YOU NEED (ALL FREE)

| Tool | Purpose | Link |
|------|---------|------|
| Node.js | Build tool runtime | https://nodejs.org |
| Git | Version control | https://git-scm.com |
| GitHub account | Host your code | https://github.com |
| Supabase account | Database + Realtime | https://supabase.com |
| Vercel account | Host the website | https://vercel.com |

---

## STEP 1 — Install Node.js and Git

**Node.js:**
1. Go to https://nodejs.org → download the LTS version
2. Install it (click Next through everything)
3. Verify: open Terminal/Command Prompt → type `node -v`

**Git:**
1. Go to https://git-scm.com/downloads
2. Download and install for your OS
3. Verify: type `git --version`

---

## STEP 2 — Set Up Supabase (Free Database)

### 2a. Create your account and project

1. Go to https://supabase.com → Start your project → Sign up with GitHub
2. Click New project
3. Fill in:
   - Project name: ezchat
   - Database password: choose a strong password and save it
   - Region: Southeast Asia (Singapore) — closest to Northern Samar
4. Click Create new project
5. Wait about 2 minutes for it to set up

### 2b. Run the database schema

1. In your Supabase project, click SQL Editor in the left sidebar
2. Click New query
3. Open the file supabase_schema.sql (provided with this project)
4. Copy ALL of it and paste into the SQL editor
5. Click Run (the green button)
6. You should see "Success. No rows returned" — that means it worked!

### 2c. Get your API keys

1. In Supabase, go to Settings (gear icon) → API
2. Copy two values:
   - Project URL — looks like https://abcdefgh.supabase.co
   - anon public key — a long string starting with eyJ...
3. Save both — you will need them in Step 3

### 2d. Enable Realtime

1. Go to Database → Replication in the left sidebar
2. Make sure these tables are toggled ON under Source:
   - messages
   - users
   - announcements
   - direct_messages

---

## STEP 3 — Set Up Your Project Files

1. Create a folder called ezchat on your computer
2. Inside it, create a src folder and a public folder
3. Place all provided files in the correct locations (see structure above)

### Create your .env file

1. Make a copy of .env.example
2. Rename the copy to .env (no extension, just .env)
3. Open .env in any text editor and fill in your Supabase values:

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...your-long-key-here
```

WARNING: Never share your .env file or upload it to GitHub.
It is already listed in .gitignore so it will not upload automatically.

---

## STEP 4 — Test Locally

Open Terminal or Command Prompt and navigate to your ezchat folder:

```bash
cd ezchat
npm install
npm run dev
```

Open your browser to http://localhost:5173

Test it:
- Click Join Chat, enter a name, enter the room
- Open a second browser tab to the same URL
- Type a message in one tab — it should appear in the other tab instantly

If messages appear in both tabs, your Supabase connection is working correctly.

Press Ctrl + C to stop when done.

---

## STEP 5 — Push to GitHub

1. Create a GitHub account at https://github.com if you do not have one
2. Go to https://github.com/new
3. Repository name: ezchat
4. Keep it Public
5. Do NOT add README or .gitignore (you already have these files)
6. Click Create repository

Run these commands inside your ezchat folder:

```bash
git init
git add .
git commit -m "EZChat initial deploy"
git remote add origin https://github.com/YOURUSERNAME/ezchat.git
git branch -M main
git push -u origin main
```

Your code is now on GitHub. The .env file will NOT be uploaded because it is in .gitignore.

---

## STEP 6 — Deploy to Vercel (Free Hosting)

1. Go to https://vercel.com → Sign up → Continue with GitHub
2. Authorize Vercel to access your GitHub
3. Click Add New → Project
4. Find and select your ezchat repository → Import

### IMPORTANT: Add Environment Variables before deploying

In the import screen, scroll down to Environment Variables. Add these two:

| Name | Value |
|------|-------|
| VITE_SUPABASE_URL | https://your-project-id.supabase.co |
| VITE_SUPABASE_ANON_KEY | eyJhbGci...your-long-key |

5. Click Deploy
6. Wait about 60 seconds

You are live! Your free URL will look like:
https://ezchat-yourusername.vercel.app

---

## STEP 7 — Test the Live Site

1. Open your Vercel URL on your phone
2. Open it again on another phone or browser
3. Both connect to the same real-time room
4. Messages from one device appear instantly on the other

If that works, EZChat is fully deployed and functional.

---

## STEP 8 — Generate QR Codes for Tables

1. Go to https://www.qr-code-generator.com
2. Paste your Vercel URL
3. Customize (black background, gold color to match EasyCart branding)
4. Download as PNG
5. Print and laminate for each table, bar top, and entrance

---

## HOW TO UPDATE THE SITE LATER

Every time you change any file, just run:

```bash
cd ezchat
git add .
git commit -m "Describe what you changed"
git push
```

Vercel detects the push and redeploys automatically in about 30 seconds. Zero downtime.

---

## MANAGING YOUR DATABASE

Go to Supabase → Table Editor to view all live data.

Useful SQL commands (run in SQL Editor):

Clear all messages:
DELETE FROM messages WHERE room_id = 'easycart-main';

Clear all users (sessions):
DELETE FROM users;

Post a new announcement:
INSERT INTO announcements (room_id, text, pinned)
VALUES ('easycart-main', 'Your message here!', true);

Delete all announcements:
DELETE FROM announcements;

---

## TROUBLESHOOTING

Messages not appearing in real time:
→ Check Supabase → Database → Replication → make sure all 4 tables are enabled

Connection error when joining:
→ Double-check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel
→ Go to Vercel → your project → Settings → Environment Variables

Users not saving:
→ Make sure you ran the full supabase_schema.sql script
→ Check Supabase → Table Editor → users table should exist

Images not uploading:
→ Go to Supabase → Storage → make sure chat-images bucket exists and is Public

Build fails on Vercel:
→ Go to Vercel → your project → Deployments → click the failed one → View Logs

npm is not recognized:
→ Restart your terminal after installing Node.js

---

## COMPLETE COST BREAKDOWN

| Item | Cost |
|------|------|
| Node.js | FREE |
| Git | FREE |
| GitHub | FREE |
| Supabase Free Plan (500MB DB, 1GB storage) | FREE |
| Vercel Free Plan (unlimited deploys) | FREE |
| QR Code generator | FREE |
| TOTAL | 0 pesos / $0 |

---

## WHAT THE DATABASE STORES

| Table | Contents |
|-------|----------|
| users | Guest nicknames, avatar colors, online status, last seen |
| messages | All chat messages, image URLs, emoji reactions |
| direct_messages | Private messages between two guests |
| announcements | Venue announcements shown to all guests |

All data is tagged with room_id = 'easycart-main' so it is completely
isolated to EasyCart and cannot mix with other venues.

---

EZChat · EasyCart Barcade & Lounge · Catarman, Northern Samar
Stack: React + Vite + Supabase + Vercel
