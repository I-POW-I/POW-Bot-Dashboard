/*
# Add Feature Tables: Auto-Mod, Custom Commands, Reaction Roles, Tickets, Webhooks

## Summary
Adds five new tables to support expanded bot management features configurable from the dashboard.

## New Tables

### 1. automod_rules
Per-guild auto-moderation rules. Each rule has a type (spam, word_filter, link_block, raid_protection, caps_lock, mention_spam) and a config JSONB blob with rule-specific settings.
- `id` — UUID primary key
- `guild_id` — Discord guild ID
- `rule_type` — enum-ish text: spam | word_filter | link_block | raid_protection | caps_lock | mention_spam | invite_block
- `enabled` — whether the rule is active
- `config` — JSONB with rule-specific parameters
- `action` — what to do: warn | delete | mute | kick | ban
- `action_duration_seconds` — for timed mutes
- `exempt_roles` — JSON array of role IDs exempt from this rule
- `exempt_channels` — JSON array of channel IDs exempt from this rule
- `created_at` / `updated_at`

### 2. custom_commands
Server admin-defined slash or text commands.
- `id` — UUID primary key
- `guild_id` — Discord guild ID
- `name` — command name (e.g. "rules", "socials")
- `description` — shown in Discord slash command list
- `response_type` — text | embed | dm
- `response_content` — the message/embed JSON
- `required_role_id` — optional role gate
- `enabled` — active toggle
- `cooldown_seconds`
- `usage_count` — incremented by bot on each use
- `created_by` — Discord user ID of creator
- `created_at` / `updated_at`

### 3. reaction_role_groups
Groups of reaction roles within a message.
- `id` — UUID primary key
- `guild_id`
- `channel_id` — where the message lives
- `message_id` — the Discord message ID
- `title` / `description` — embed text
- `mode` — single (only one at a time) | multiple | verify (first role only)
- `max_roles` — 0 = unlimited
- `enabled`
- `created_at` / `updated_at`

### 4. reaction_roles
Individual reaction ↔ role mappings within a group.
- `id` — UUID PK
- `group_id` — FK to reaction_role_groups
- `emoji` — the emoji (unicode or custom ID)
- `role_id` — Discord role ID to grant
- `label` — display label
- `description` — optional tooltip text
- `position` — ordering

### 5. ticket_configs
Per-guild ticket system configuration.
- `id` — UUID PK
- `guild_id` — UNIQUE, one config per guild
- `enabled`
- `category_id` — Discord category for ticket channels
- `support_role_id` — role that can see/manage tickets
- `log_channel_id` — where ticket transcripts go
- `welcome_message` — first message posted in ticket channel
- `max_open_tickets` — per user limit (default 1)
- `auto_close_hours` — close after inactivity (0 = disabled)
- `claim_button` — show "claim ticket" button
- `close_button` — show "close" button
- `transcript_on_close` — send HTML transcript to log channel
- `created_at` / `updated_at`

### 6. webhook_configs
Discord webhooks the bot manages, usable from the dashboard.
- `id` — UUID PK
- `guild_id`
- `name` — display name
- `webhook_url` — Discord webhook URL (encrypted at app layer)
- `channel_id`
- `avatar_url` — custom avatar for this webhook
- `username` — override display name
- `type` — custom | twitch | youtube | github | rss | weather
- `trigger_config` — JSONB for type-specific config (repo, feed URL, etc.)
- `enabled`
- `last_triggered_at`
- `total_sent`
- `created_at` / `updated_at`

## Security
- RLS enabled on all tables.
- `TO authenticated` policies since the dashboard requires sign-in.
- All tables scope by `guild_id` at the app layer — full row access to authenticated users.

## Notes
1. All tables idempotent — safe to re-run.
2. Indexes added on guild_id for fast per-guild queries.
3. Foreign key on reaction_roles.group_id with ON DELETE CASCADE.
*/

-- ── automod_rules ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS automod_rules (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id              text NOT NULL,
  rule_type             text NOT NULL CHECK (rule_type IN (
    'spam','word_filter','link_block','raid_protection','caps_lock','mention_spam','invite_block'
  )),
  enabled               boolean NOT NULL DEFAULT true,
  config                jsonb NOT NULL DEFAULT '{}',
  action                text NOT NULL DEFAULT 'delete' CHECK (action IN ('warn','delete','mute','kick','ban')),
  action_duration_seconds integer,
  exempt_roles          jsonb NOT NULL DEFAULT '[]',
  exempt_channels       jsonb NOT NULL DEFAULT '[]',
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS automod_rules_guild_id_idx ON automod_rules(guild_id);
ALTER TABLE automod_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_select_automod_rules" ON automod_rules;
CREATE POLICY "auth_select_automod_rules" ON automod_rules FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert_automod_rules" ON automod_rules;
CREATE POLICY "auth_insert_automod_rules" ON automod_rules FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_update_automod_rules" ON automod_rules;
CREATE POLICY "auth_update_automod_rules" ON automod_rules FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_delete_automod_rules" ON automod_rules;
CREATE POLICY "auth_delete_automod_rules" ON automod_rules FOR DELETE TO authenticated USING (true);

-- ── custom_commands ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS custom_commands (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id          text NOT NULL,
  name              text NOT NULL,
  description       text NOT NULL DEFAULT '',
  response_type     text NOT NULL DEFAULT 'text' CHECK (response_type IN ('text','embed','dm')),
  response_content  text NOT NULL DEFAULT '',
  required_role_id  text,
  enabled           boolean NOT NULL DEFAULT true,
  cooldown_seconds  integer NOT NULL DEFAULT 0,
  usage_count       integer NOT NULL DEFAULT 0,
  created_by        text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (guild_id, name)
);
CREATE INDEX IF NOT EXISTS custom_commands_guild_id_idx ON custom_commands(guild_id);
ALTER TABLE custom_commands ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_select_custom_commands" ON custom_commands;
CREATE POLICY "auth_select_custom_commands" ON custom_commands FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert_custom_commands" ON custom_commands;
CREATE POLICY "auth_insert_custom_commands" ON custom_commands FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_update_custom_commands" ON custom_commands;
CREATE POLICY "auth_update_custom_commands" ON custom_commands FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_delete_custom_commands" ON custom_commands;
CREATE POLICY "auth_delete_custom_commands" ON custom_commands FOR DELETE TO authenticated USING (true);

-- ── reaction_role_groups ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS reaction_role_groups (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id    text NOT NULL,
  channel_id  text,
  message_id  text,
  title       text NOT NULL DEFAULT 'Choose your roles',
  description text NOT NULL DEFAULT '',
  mode        text NOT NULL DEFAULT 'multiple' CHECK (mode IN ('single','multiple','verify')),
  max_roles   integer NOT NULL DEFAULT 0,
  enabled     boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rrg_guild_id_idx ON reaction_role_groups(guild_id);
ALTER TABLE reaction_role_groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_select_rrg" ON reaction_role_groups;
CREATE POLICY "auth_select_rrg" ON reaction_role_groups FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert_rrg" ON reaction_role_groups;
CREATE POLICY "auth_insert_rrg" ON reaction_role_groups FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_update_rrg" ON reaction_role_groups;
CREATE POLICY "auth_update_rrg" ON reaction_role_groups FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_delete_rrg" ON reaction_role_groups;
CREATE POLICY "auth_delete_rrg" ON reaction_role_groups FOR DELETE TO authenticated USING (true);

-- ── reaction_roles ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS reaction_roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    uuid NOT NULL REFERENCES reaction_role_groups(id) ON DELETE CASCADE,
  emoji       text NOT NULL,
  role_id     text NOT NULL,
  label       text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  position    integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS rr_group_id_idx ON reaction_roles(group_id);
ALTER TABLE reaction_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_select_rr" ON reaction_roles;
CREATE POLICY "auth_select_rr" ON reaction_roles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert_rr" ON reaction_roles;
CREATE POLICY "auth_insert_rr" ON reaction_roles FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_update_rr" ON reaction_roles;
CREATE POLICY "auth_update_rr" ON reaction_roles FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_delete_rr" ON reaction_roles;
CREATE POLICY "auth_delete_rr" ON reaction_roles FOR DELETE TO authenticated USING (true);

-- ── ticket_configs ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ticket_configs (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id              text NOT NULL UNIQUE,
  enabled               boolean NOT NULL DEFAULT false,
  category_id           text,
  support_role_id       text,
  log_channel_id        text,
  welcome_message       text NOT NULL DEFAULT 'Thanks for opening a ticket! A staff member will be with you shortly.',
  max_open_tickets      integer NOT NULL DEFAULT 1,
  auto_close_hours      integer NOT NULL DEFAULT 0,
  claim_button          boolean NOT NULL DEFAULT true,
  close_button          boolean NOT NULL DEFAULT true,
  transcript_on_close   boolean NOT NULL DEFAULT true,
  button_label          text NOT NULL DEFAULT 'Open a Ticket',
  button_emoji          text NOT NULL DEFAULT '🎟️',
  button_style          text NOT NULL DEFAULT 'primary' CHECK (button_style IN ('primary','secondary','success','danger')),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE ticket_configs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_select_ticket_configs" ON ticket_configs;
CREATE POLICY "auth_select_ticket_configs" ON ticket_configs FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert_ticket_configs" ON ticket_configs;
CREATE POLICY "auth_insert_ticket_configs" ON ticket_configs FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_update_ticket_configs" ON ticket_configs;
CREATE POLICY "auth_update_ticket_configs" ON ticket_configs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_delete_ticket_configs" ON ticket_configs;
CREATE POLICY "auth_delete_ticket_configs" ON ticket_configs FOR DELETE TO authenticated USING (true);

-- ── webhook_configs ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS webhook_configs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id            text NOT NULL,
  name                text NOT NULL,
  webhook_url         text NOT NULL DEFAULT '',
  channel_id          text,
  avatar_url          text,
  username            text,
  type                text NOT NULL DEFAULT 'custom' CHECK (type IN ('custom','twitch','youtube','github','rss','weather')),
  trigger_config      jsonb NOT NULL DEFAULT '{}',
  enabled             boolean NOT NULL DEFAULT true,
  last_triggered_at   timestamptz,
  total_sent          integer NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS webhook_configs_guild_id_idx ON webhook_configs(guild_id);
ALTER TABLE webhook_configs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_select_webhook_configs" ON webhook_configs;
CREATE POLICY "auth_select_webhook_configs" ON webhook_configs FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert_webhook_configs" ON webhook_configs;
CREATE POLICY "auth_insert_webhook_configs" ON webhook_configs FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_update_webhook_configs" ON webhook_configs;
CREATE POLICY "auth_update_webhook_configs" ON webhook_configs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_delete_webhook_configs" ON webhook_configs;
CREATE POLICY "auth_delete_webhook_configs" ON webhook_configs FOR DELETE TO authenticated USING (true);
