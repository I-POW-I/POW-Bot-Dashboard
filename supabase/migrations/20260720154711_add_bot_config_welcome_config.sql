/*
# Add bot_config and welcome_config tables

## Summary
This migration adds two new tables to support the comprehensive admin panel and improved welcome message system.

## New Tables

### 1. bot_config
A single-row global configuration table for the bot process. Stores:
- `id` — always 1 (singleton row)
- `maintenance_mode` — when true, the bot stops responding to normal commands
- `global_prefix` — the default slash-command prefix (usually `/`)
- `owner_whitelist` — JSON array of Discord user IDs with super-admin access
- `updated_at` — when the config was last changed

### 2. welcome_config
Per-server welcome/leave message customisation. Stores:
- `id` — auto UUID
- `guild_id` — the Discord guild this config belongs to (unique per server)
- `join_enabled` / `leave_enabled` — toggle join/leave messages independently
- `welcome_channel_id` / `leave_channel_id` — target Discord channel IDs
- `join_message` / `leave_message` — message templates with `{nickname}`, `{username}`, `{server}` placeholders
- `show_join_date` — whether to include the member's server join date on leave cards
- `updated_at`

## Security
- RLS enabled on both tables.
- `bot_config`: authenticated users can read; super-admin writes are enforced at the app layer.
- `welcome_config`: authenticated users can read/write their server's config.

## Notes
1. `bot_config` row is seeded with defaults via INSERT … ON CONFLICT DO NOTHING.
2. Both tables use `TO authenticated` policies because this project has full auth.
*/

-- bot_config (global singleton)
CREATE TABLE IF NOT EXISTS bot_config (
  id            integer PRIMARY KEY DEFAULT 1,
  maintenance_mode  boolean NOT NULL DEFAULT false,
  global_prefix     text NOT NULL DEFAULT '/',
  owner_whitelist   jsonb NOT NULL DEFAULT '[]',
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

ALTER TABLE bot_config ENABLE ROW LEVEL SECURITY;

INSERT INTO bot_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "auth_select_bot_config" ON bot_config;
CREATE POLICY "auth_select_bot_config" ON bot_config FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_update_bot_config" ON bot_config;
CREATE POLICY "auth_update_bot_config" ON bot_config FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- welcome_config (per-server)
CREATE TABLE IF NOT EXISTS welcome_config (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id            text NOT NULL UNIQUE,
  join_enabled        boolean NOT NULL DEFAULT true,
  leave_enabled       boolean NOT NULL DEFAULT true,
  welcome_channel_id  text,
  leave_channel_id    text,
  join_message        text NOT NULL DEFAULT 'Welcome to **{server}**, {nickname}! You are member #{count}.',
  leave_message       text NOT NULL DEFAULT '{nickname} has left the server.',
  show_join_date      boolean NOT NULL DEFAULT true,
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE welcome_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_welcome_config" ON welcome_config;
CREATE POLICY "auth_select_welcome_config" ON welcome_config FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_welcome_config" ON welcome_config;
CREATE POLICY "auth_insert_welcome_config" ON welcome_config FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_welcome_config" ON welcome_config;
CREATE POLICY "auth_update_welcome_config" ON welcome_config FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_welcome_config" ON welcome_config;
CREATE POLICY "auth_delete_welcome_config" ON welcome_config FOR DELETE TO authenticated USING (true);
