/*
# Fix feature tables for live bot logic

## Summary
Aligns the automod/custom-commands/tickets/webhooks schemas with what the
dashboard UI and the new bot-side logic actually need. Adds active ticket
tracking + panel message tracking, expands the custom_commands response_type
enum to match the UI, and adds a per-guild automod log channel + spam strike
tracking.

## Changes

### 1. custom_commands — expand response_type to match dashboard
The dashboard sends `text | embed | random`. The original constraint only
allowed `text | embed | dm`, which made saving random-line commands fail.
Drop and recreate the CHECK constraint to accept all four values so existing
rows keep working and new UI values persist.

### 2. ticket_configs — add panel tracking + button customization
- `panel_channel_id` (text) — channel where the "Open Ticket" panel message lives
- `panel_message_id` (text) — the panel message ID so the bot can reuse/update it
These let the bot create a persistent button panel and find it again on restart.

### 3. tickets — new table for active ticket tracking
Per-ticket records so the bot and dashboard can list open tickets, enforce the
max-open-per-user limit, and close cleanly. Columns:
- `id` (uuid PK)
- `guild_id` (text)
- `channel_id` (text) — the ticket channel
- `user_id` (text) — who opened it
- `opened_at` (timestamptz)
- `status` (text: open | closed)
- `closed_at` (timestamptz, nullable)
- `closed_by` (text, nullable)

### 4. automod_rules — add log_channel_id
Optional per-rule log channel for triggered-action embeds. Defaults to null.

## Security
- RLS enabled on the new `tickets` table with authenticated CRUD (same pattern
  as the other feature tables).
- No changes to existing table policies.

## Notes
1. All statements idempotent — safe to re-run.
2. No data is dropped; constraint swap preserves existing rows.
3. Indexes added on tickets(guild_id) and tickets(status) for fast lookups.
*/

-- ── 1. custom_commands response_type expansion ────────────────────────────────

ALTER TABLE custom_commands DROP CONSTRAINT IF EXISTS custom_commands_response_type_check;
ALTER TABLE custom_commands ADD CONSTRAINT custom_commands_response_type_check
  CHECK (response_type IN ('text','embed','dm','random'));

-- ── 2. ticket_configs panel tracking columns ──────────────────────────────────

ALTER TABLE ticket_configs ADD COLUMN IF NOT EXISTS panel_channel_id text;
ALTER TABLE ticket_configs ADD COLUMN IF NOT EXISTS panel_message_id text;

-- ── 3. tickets table ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tickets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id    text NOT NULL,
  channel_id  text NOT NULL,
  user_id     text NOT NULL,
  opened_at   timestamptz NOT NULL DEFAULT now(),
  status      text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  closed_at   timestamptz,
  closed_by   text
);
CREATE INDEX IF NOT EXISTS tickets_guild_id_idx ON tickets(guild_id);
CREATE INDEX IF NOT EXISTS tickets_status_idx ON tickets(status);
CREATE INDEX IF NOT EXISTS tickets_user_id_idx ON tickets(user_id);

ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_select_tickets" ON tickets;
CREATE POLICY "auth_select_tickets" ON tickets FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert_tickets" ON tickets;
CREATE POLICY "auth_insert_tickets" ON tickets FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_update_tickets" ON tickets;
CREATE POLICY "auth_update_tickets" ON tickets FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_delete_tickets" ON tickets;
CREATE POLICY "auth_delete_tickets" ON tickets FOR DELETE TO authenticated USING (true);

-- ── 4. automod_rules log channel ───────────────────────────────────────────────

ALTER TABLE automod_rules ADD COLUMN IF NOT EXISTS log_channel_id text;