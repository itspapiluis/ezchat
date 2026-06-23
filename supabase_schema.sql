-- ============================================================
-- EZChat Database Schema for Supabase
-- EasyCart Barcade & Lounge · Catarman, Northern Samar
-- ============================================================
-- Run this entire script in:
-- Supabase Dashboard → SQL Editor → New Query → Paste → Run
-- ============================================================


-- ── 1. USERS table ──────────────────────────────────────────
-- Stores all guests who have joined the chat session

CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT '#C9A84C',
  room_id     TEXT NOT NULL DEFAULT 'easycart-main',
  status      TEXT NOT NULL DEFAULT 'online',
  avatar_url  TEXT,
  last_seen   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-remove users who haven't been seen in 10 minutes
-- (handled by the app heartbeat, this just cleans old rows)
CREATE INDEX IF NOT EXISTS idx_users_room_seen ON users(room_id, last_seen);


-- ── 2. MESSAGES table ───────────────────────────────────────
-- Stores all chat messages in the main room

CREATE TABLE IF NOT EXISTS messages (
  id          BIGSERIAL PRIMARY KEY,
  room_id     TEXT NOT NULL DEFAULT 'easycart-main',
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text        TEXT,
  image_url   TEXT,
  type        TEXT NOT NULL DEFAULT 'text',   -- 'text' | 'image' | 'system'
  reactions   JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_room_created ON messages(room_id, created_at);


-- ── 3. DIRECT MESSAGES table ────────────────────────────────
-- Stores private messages between two users

CREATE TABLE IF NOT EXISTS direct_messages (
  id          BIGSERIAL PRIMARY KEY,
  from_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dm_participants ON direct_messages(from_id, to_id, created_at);


-- ── 4. ANNOUNCEMENTS table ──────────────────────────────────
-- Stores venue announcements (managed by staff via admin panel)

CREATE TABLE IF NOT EXISTS announcements (
  id          BIGSERIAL PRIMARY KEY,
  room_id     TEXT NOT NULL DEFAULT 'easycart-main',
  text        TEXT NOT NULL,
  pinned      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ann_room ON announcements(room_id, pinned, created_at);


-- ── 5. STORAGE BUCKET ───────────────────────────────────────
-- For photo sharing in chat
-- Run this separately if the bucket doesn't exist yet

INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-images', 'chat-images', true)
ON CONFLICT (id) DO NOTHING;


-- ── 6. ROW LEVEL SECURITY (RLS) ─────────────────────────────
-- Allow anyone with the anon key to read and write
-- This is appropriate for a venue chat (no auth required)

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- Users: anyone can insert and read
CREATE POLICY "Anyone can join" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can see users" ON users FOR SELECT USING (true);
CREATE POLICY "Users can update themselves" ON users FOR UPDATE USING (true);

-- Messages: anyone can send and read
CREATE POLICY "Anyone can send messages" ON messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read messages" ON messages FOR SELECT USING (true);
CREATE POLICY "Anyone can react" ON messages FOR UPDATE USING (true);

-- Direct messages: anyone can send and read their own DMs
CREATE POLICY "Anyone can send DMs" ON direct_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read DMs" ON direct_messages FOR SELECT USING (true);

-- Announcements: anyone can read (only staff write via admin panel)
CREATE POLICY "Anyone can read announcements" ON announcements FOR SELECT USING (true);
CREATE POLICY "Anyone can post announcements" ON announcements FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update announcements" ON announcements FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete announcements" ON announcements FOR DELETE USING (true);

-- Storage: allow public uploads and reads
CREATE POLICY "Anyone can upload images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'chat-images');

CREATE POLICY "Anyone can view images"
ON storage.objects FOR SELECT
USING (bucket_id = 'chat-images');


-- ── 7. REALTIME ─────────────────────────────────────────────
-- Enable real-time on the tables that need live updates

ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE users;
ALTER PUBLICATION supabase_realtime ADD TABLE announcements;
ALTER PUBLICATION supabase_realtime ADD TABLE direct_messages;


-- ── 8. SEED DATA ─────────────────────────────────────────────
-- Optional: Add a welcome announcement to start with

INSERT INTO announcements (room_id, text, pinned)
VALUES
  ('easycart-main', '🥂 Welcome to EasyCart Barcade & Lounge! Have an amazing night!', true),
  ('easycart-main', '🎮 Barcade games open all night — challenge someone!', false),
  ('easycart-main', '🏆 VIP booth reservations available — see the host', false),
  ('easycart-main', '🎶 Live music starts at 9PM — do not miss it!', false);


-- ============================================================
-- DONE! Your database is ready.
-- Next: copy your Project URL and anon key into your .env file
-- ============================================================
