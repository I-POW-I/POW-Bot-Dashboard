/*
# 247-Pow-Bot Dashboard Schema

## Overview
Creates the database schema for the 247-Pow-Bot web dashboard. The dashboard
is a Discord-authenticated multi-tenant app: users sign in with Discord OAuth,
and each user can manage the servers (guilds) they share with the bot.

This schema mirrors the bot's existing data model (per-guild JSON config +
SQLite tables for vc_sessions, streamer_subscriptions, game_subscriptions) but
normalizes it into Postgres tables that the dashboard can query and update.
The bot itself continues to read/write its own files; the dashboard's tables
are the source of truth for dashboard-only concerns (audit log, user roles,
announcements) and a read-optimized mirror for display data.

## New Tables
1. `dashboard_users` — Discord users who have signed in. Mirrors auth.users
   via a 1:1 link on discord_id. Stores avatar, username, global role.
2. `guild_members` — Per-guild membership + RBAC role for each dashboard user.
   Determines what a user can do in each server's dashboard.
3. `guild_configs` — Per-guild bot configuration mirror: log channels, panel
   channel/message, welcome/leave channels, verify role, bot-control role,
   24/7 target voice channel, last channel, stats.
4. `vc_sessions` — Voice channel session log (mirrors the bot's SQLite table).
   Tracks per-user VC time for leaderboards and stats.
5. `streamer_subscriptions` — Streamer live-notification subscriptions
   (Kick / Twitch / YouTube) per guild.
6. `game_subscriptions` — Free-game alert subscriptions per guild.
7. `audit_log` — Dashboard action audit trail. Every settings change made via
   the dashboard writes a row here.
8. `announcements` — Owner announcement drafts + send history.
9. `blacklist` — Blacklisted guilds/users (owner-only).
10. `bot_status` — Singleton row tracking live bot process status (uptime,
    memory, ping, active connections). Updated by the bot or by an owner.

## Security
- RLS enabled on every table.
- `dashboard_users`, `guild_members` are owner-scoped (auth.uid() = user_id).
- `guild_configs`, `vc_sessions`, `streamer_subscriptions`,
  `game_subscriptions`, `audit_log` are scoped to users who are members of the
  relevant guild with at least Viewer role.
- `announcements`, `blacklist`, `bot_status` are owner-only (global role =
  'owner') — readable by owner, writable by owner.
- All owner columns default to auth.uid() so inserts from the anon-key client
  that omit the owner still satisfy WITH CHECK.

## Notes
1. The dashboard uses Supabase email/password auth as the session layer, but
   the Discord identity (id, username, avatar) is stored in dashboard_users
   after the Discord OAuth handshake completes in the Next.js route handler.
2. RBAC roles are stored as a text enum-ish column with CHECK constraint:
   'owner' | 'admin' | 'moderator' | 'viewer'.
3. The bot's actual config file (data/guild-config.json) remains the source of
   truth at runtime; the dashboard's guild_configs table is synced from it.
*/

-- ── Extensions ─────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── 1. dashboard_users ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dashboard_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  discord_id text UNIQUE NOT NULL,
  username text NOT NULL,
  global_name text,
  avatar_url text,
  global_role text NOT NULL DEFAULT 'viewer'
    CHECK (global_role IN ('owner','admin','moderator','viewer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE dashboard_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_dashboard_user" ON dashboard_users;
CREATE POLICY "select_own_dashboard_user" ON dashboard_users
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_dashboard_user" ON dashboard_users;
CREATE POLICY "insert_own_dashboard_user" ON dashboard_users
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_dashboard_user" ON dashboard_users;
CREATE POLICY "update_own_dashboard_user" ON dashboard_users
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── 2. guild_members ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS guild_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  guild_id text NOT NULL,
  role text NOT NULL DEFAULT 'viewer'
    CHECK (role IN ('owner','admin','moderator','viewer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, guild_id)
);

ALTER TABLE guild_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_guild_members" ON guild_members;
CREATE POLICY "select_own_guild_members" ON guild_members
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_guild_members" ON guild_members;
CREATE POLICY "insert_own_guild_members" ON guild_members
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_guild_members" ON guild_members;
CREATE POLICY "update_own_guild_members" ON guild_members
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_guild_members" ON guild_members;
CREATE POLICY "delete_own_guild_members" ON guild_members
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ── 3. guild_configs ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS guild_configs (
  guild_id text PRIMARY KEY,
  guild_name text,
  guild_icon text,
  log_channels jsonb NOT NULL DEFAULT '{}'::jsonb,
  panel_channel_id text,
  panel_message_id text,
  welcome_channel_id text,
  leave_channel_id text,
  verify_role_id text,
  verify_channel_id text,
  verify_message_id text,
  bot_control_role_id text,
  target_voice_channel_id text,
  last_channel_id text,
  joined_at timestamptz,
  reconnect_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE guild_configs ENABLE ROW LEVEL SECURITY;

-- Readable by any authenticated user who is a member of the guild.
DROP POLICY IF EXISTS "select_guild_configs_for_members" ON guild_configs;
CREATE POLICY "select_guild_configs_for_members" ON guild_configs
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM guild_members gm
      WHERE gm.guild_id = guild_configs.guild_id AND gm.user_id = auth.uid()
    )
  );

-- Writable by owner (global) or admin/moderator of the guild.
DROP POLICY IF EXISTS "update_guild_configs_for_admins" ON guild_configs;
CREATE POLICY "update_guild_configs_for_admins" ON guild_configs
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM dashboard_users du
      WHERE du.user_id = auth.uid() AND du.global_role = 'owner'
    )
    OR EXISTS (
      SELECT 1 FROM guild_members gm
      WHERE gm.guild_id = guild_configs.guild_id
        AND gm.user_id = auth.uid()
        AND gm.role IN ('admin','moderator')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM dashboard_users du
      WHERE du.user_id = auth.uid() AND du.global_role = 'owner'
    )
    OR EXISTS (
      SELECT 1 FROM guild_members gm
      WHERE gm.guild_id = guild_configs.guild_id
        AND gm.user_id = auth.uid()
        AND gm.role IN ('admin','moderator')
    )
  );

-- Owner can insert new guild configs (when bot joins a new server).
DROP POLICY IF EXISTS "insert_guild_configs_owner" ON guild_configs;
CREATE POLICY "insert_guild_configs_owner" ON guild_configs
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM dashboard_users du
      WHERE du.user_id = auth.uid() AND du.global_role = 'owner'
    )
  );

-- ── 4. vc_sessions ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vc_sessions (
  id bigserial PRIMARY KEY,
  user_discord_id text NOT NULL,
  guild_id text NOT NULL,
  channel_id text NOT NULL,
  channel_name text,
  username text,
  avatar_url text,
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  duration_ms bigint
);

CREATE INDEX IF NOT EXISTS idx_vc_sessions_user_guild ON vc_sessions (user_discord_id, guild_id);
CREATE INDEX IF NOT EXISTS idx_vc_sessions_guild ON vc_sessions (guild_id);
CREATE INDEX IF NOT EXISTS idx_vc_sessions_joined ON vc_sessions (joined_at DESC);

ALTER TABLE vc_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_vc_sessions_for_members" ON vc_sessions;
CREATE POLICY "select_vc_sessions_for_members" ON vc_sessions
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM guild_members gm
      WHERE gm.guild_id = vc_sessions.guild_id AND gm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "insert_vc_sessions_owner" ON vc_sessions;
CREATE POLICY "insert_vc_sessions_owner" ON vc_sessions
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM dashboard_users du
      WHERE du.user_id = auth.uid() AND du.global_role = 'owner'
    )
  );

-- ── 5. streamer_subscriptions ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS streamer_subscriptions (
  id bigserial PRIMARY KEY,
  guild_id text NOT NULL,
  platform text NOT NULL CHECK (platform IN ('kick','twitch','youtube')),
  username text NOT NULL,
  display_name text,
  discord_channel_id text NOT NULL,
  role_id text,
  is_live boolean NOT NULL DEFAULT false,
  last_message_id text,
  last_went_live timestamptz,
  last_stream_title text,
  last_updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (guild_id, platform, username)
);

CREATE INDEX IF NOT EXISTS idx_streamer_guild ON streamer_subscriptions (guild_id);

ALTER TABLE streamer_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_streamer_for_members" ON streamer_subscriptions;
CREATE POLICY "select_streamer_for_members" ON streamer_subscriptions
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM guild_members gm
      WHERE gm.guild_id = streamer_subscriptions.guild_id AND gm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "modify_streamer_for_admins" ON streamer_subscriptions;
CREATE POLICY "modify_streamer_for_admins" ON streamer_subscriptions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM dashboard_users du
      WHERE du.user_id = auth.uid() AND du.global_role = 'owner'
    )
    OR EXISTS (
      SELECT 1 FROM guild_members gm
      WHERE gm.guild_id = streamer_subscriptions.guild_id
        AND gm.user_id = auth.uid()
        AND gm.role IN ('admin','moderator')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM dashboard_users du
      WHERE du.user_id = auth.uid() AND du.global_role = 'owner'
    )
    OR EXISTS (
      SELECT 1 FROM guild_members gm
      WHERE gm.guild_id = streamer_subscriptions.guild_id
        AND gm.user_id = auth.uid()
        AND gm.role IN ('admin','moderator')
    )
  );

-- ── 6. game_subscriptions ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS game_subscriptions (
  id bigserial PRIMARY KEY,
  guild_id text NOT NULL,
  app_id text NOT NULL,
  game_name text,
  channel_id text NOT NULL,
  role_id text,
  last_post_id text,
  color integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (guild_id, app_id)
);

CREATE INDEX IF NOT EXISTS idx_game_guild ON game_subscriptions (guild_id);

ALTER TABLE game_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_game_for_members" ON game_subscriptions;
CREATE POLICY "select_game_for_members" ON game_subscriptions
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM guild_members gm
      WHERE gm.guild_id = game_subscriptions.guild_id AND gm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "modify_game_for_admins" ON game_subscriptions;
CREATE POLICY "modify_game_for_admins" ON game_subscriptions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM dashboard_users du
      WHERE du.user_id = auth.uid() AND du.global_role = 'owner'
    )
    OR EXISTS (
      SELECT 1 FROM guild_members gm
      WHERE gm.guild_id = game_subscriptions.guild_id
        AND gm.user_id = auth.uid()
        AND gm.role IN ('admin','moderator')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM dashboard_users du
      WHERE du.user_id = auth.uid() AND du.global_role = 'owner'
    )
    OR EXISTS (
      SELECT 1 FROM guild_members gm
      WHERE gm.guild_id = game_subscriptions.guild_id
        AND gm.user_id = auth.uid()
        AND gm.role IN ('admin','moderator')
    )
  );

-- ── 7. audit_log ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id bigserial PRIMARY KEY,
  guild_id text NOT NULL,
  actor_discord_id text,
  actor_username text,
  action text NOT NULL,
  category text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_guild ON audit_log (guild_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_category ON audit_log (category);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_audit_for_members" ON audit_log;
CREATE POLICY "select_audit_for_members" ON audit_log
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM guild_members gm
      WHERE gm.guild_id = audit_log.guild_id AND gm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "insert_audit_for_members" ON audit_log;
CREATE POLICY "insert_audit_for_members" ON audit_log
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM guild_members gm
      WHERE gm.guild_id = audit_log.guild_id AND gm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM dashboard_users du
      WHERE du.user_id = auth.uid() AND du.global_role = 'owner'
    )
  );

-- ── 8. announcements ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  color integer NOT NULL DEFAULT 0x5865F2,
  target_guild_ids text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','sent','failed')),
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_announcements_owner" ON announcements;
CREATE POLICY "select_announcements_owner" ON announcements
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM dashboard_users du
      WHERE du.user_id = auth.uid() AND du.global_role = 'owner'
    )
  );

DROP POLICY IF EXISTS "insert_announcements_owner" ON announcements;
CREATE POLICY "insert_announcements_owner" ON announcements
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM dashboard_users du
      WHERE du.user_id = auth.uid() AND du.global_role = 'owner'
    )
  );

DROP POLICY IF EXISTS "update_announcements_owner" ON announcements;
CREATE POLICY "update_announcements_owner" ON announcements
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM dashboard_users du
      WHERE du.user_id = auth.uid() AND du.global_role = 'owner'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM dashboard_users du
      WHERE du.user_id = auth.uid() AND du.global_role = 'owner'
    )
  );

DROP POLICY IF EXISTS "delete_announcements_owner" ON announcements;
CREATE POLICY "delete_announcements_owner" ON announcements
  FOR DELETE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM dashboard_users du
      WHERE du.user_id = auth.uid() AND du.global_role = 'owner'
    )
  );

-- ── 9. blacklist ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS blacklist (
  id bigserial PRIMARY KEY,
  target_type text NOT NULL CHECK (target_type IN ('guild','user')),
  target_id text NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (target_type, target_id)
);

ALTER TABLE blacklist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_blacklist_owner" ON blacklist;
CREATE POLICY "select_blacklist_owner" ON blacklist
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM dashboard_users du
      WHERE du.user_id = auth.uid() AND du.global_role = 'owner'
    )
  );

DROP POLICY IF EXISTS "modify_blacklist_owner" ON blacklist;
CREATE POLICY "modify_blacklist_owner" ON blacklist
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM dashboard_users du
      WHERE du.user_id = auth.uid() AND du.global_role = 'owner'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM dashboard_users du
      WHERE du.user_id = auth.uid() AND du.global_role = 'owner'
    )
  );

-- ── 10. bot_status ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bot_status (
  id integer PRIMARY KEY DEFAULT 1,
  online boolean NOT NULL DEFAULT true,
  ping_ms integer NOT NULL DEFAULT 0,
  process_uptime_ms bigint NOT NULL DEFAULT 0,
  memory_mb numeric NOT NULL DEFAULT 0,
  active_connections integer NOT NULL DEFAULT 0,
  total_guilds integer NOT NULL DEFAULT 0,
  total_members integer NOT NULL DEFAULT 0,
  presence_activity text,
  presence_type text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bot_status_singleton CHECK (id = 1)
);

INSERT INTO bot_status (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE bot_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_bot_status_authenticated" ON bot_status;
CREATE POLICY "select_bot_status_authenticated" ON bot_status
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "update_bot_status_owner" ON bot_status;
CREATE POLICY "update_bot_status_owner" ON bot_status
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM dashboard_users du
      WHERE du.user_id = auth.uid() AND du.global_role = 'owner'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM dashboard_users du
      WHERE du.user_id = auth.uid() AND du.global_role = 'owner'
    )
  );
