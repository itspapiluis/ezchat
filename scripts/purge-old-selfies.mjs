// OPTIONAL, MANUAL. Deletes selfie photos older than N days (default 90).
// Log rows are kept; only the photo is removed and selfie_path is cleared.
// Never runs automatically. DRY RUN by default: it only lists what it would delete.
//
// PowerShell (from the repo root):
//   $env:SUPABASE_URL="https://YOURPROJECT.supabase.co"
//   $env:SUPABASE_SERVICE_ROLE_KEY="paste-service-role-key-here"
//   node scripts/purge-old-selfies.mjs            # dry run
//   node scripts/purge-old-selfies.mjs --run      # really delete
//
// The service-role key is a master key. Never put it in the repo, in Vercel
// env vars, or in any VITE_ variable. Use it only in your own terminal.
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const days = Number(process.env.RETENTION_DAYS || 90);
const run = process.argv.includes("--run");

if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.");
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });
const cutoff = new Date(Date.now() - days * 864e5).toISOString();

const { data, error } = await sb
  .from("attendance_logs")
  .select("id, selfie_path")
  .lt("logged_at", cutoff)
  .not("selfie_path", "is", null)
  .limit(1000);

if (error) { console.error(error.message); process.exit(1); }
if (!data.length) { console.log(`No selfies older than ${days} days.`); process.exit(0); }

console.log(`${data.length} selfie(s) older than ${days} days (before ${cutoff}).`);
if (!run) { console.log("Dry run only. Add --run to delete them."); process.exit(0); }

const paths = data.map((r) => r.selfie_path);
const { error: rmErr } = await sb.storage.from("attendance-selfies").remove(paths);
if (rmErr) { console.error("Delete failed:", rmErr.message); process.exit(1); }

const { error: upErr } = await sb
  .from("attendance_logs")
  .update({ selfie_path: null })
  .in("id", data.map((r) => r.id));
if (upErr) { console.error("Photos deleted but could not clear paths:", upErr.message); process.exit(1); }

console.log(`Deleted ${paths.length} photo(s). Run again if there were more than 1000.`);
