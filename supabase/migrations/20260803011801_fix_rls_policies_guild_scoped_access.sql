-- ───────────────────────────────────────────────────────────────────────────
-- Fix RLS policies: replace USING(true) with proper guild-scoped ownership
-- checks. Previously any authenticated user could read/modify ANY guild's
-- automod rules, tickets, reaction roles, webhooks, etc.
-- ───────────────────────────────────────────────────────────────────────────

-- Helper function: check if current auth user is a member of a guild.
-- Returns true if the user has a row in guild_members for that guild_id.
CREATE OR REPLACE FUNCTION public.user_in_guild(check_guild_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM guild_members
    WHERE user_id = auth.uid()
      AND guild_id = check_guild_id
  );
$$;

-- Helper function: check if current auth user is an admin/owner of a guild.
CREATE OR REPLACE FUNCTION public.user_is_guild_admin(check_guild_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM guild_members
    WHERE user_id = auth.uid()
      AND guild_id = check_guild_id
      AND role IN ('owner', 'admin')
  );
$$;

-- Helper function: check if current auth user is the global owner.
CREATE OR REPLACE FUNCTION public.user_is_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM dashboard_users
    WHERE user_id = auth.uid()
      AND global_role = 'owner'
  );
$$;

-- ── automod_rules ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS auth_select_automod_rules ON automod_rules;
DROP POLICY IF EXISTS auth_insert_automod_rules ON automod_rules;
DROP POLICY IF EXISTS auth_update_automod_rules ON automod_rules;
DROP POLICY IF EXISTS auth_delete_automod_rules ON automod_rules;

CREATE POLICY select_automod_rules ON automod_rules FOR SELECT
  TO authenticated USING (user_in_guild(guild_id));
CREATE POLICY insert_automod_rules ON automod_rules FOR INSERT
  TO authenticated WITH CHECK (user_is_guild_admin(guild_id));
CREATE POLICY update_automod_rules ON automod_rules FOR UPDATE
  TO authenticated USING (user_is_guild_admin(guild_id))
  WITH CHECK (user_is_guild_admin(guild_id));
CREATE POLICY delete_automod_rules ON automod_rules FOR DELETE
  TO authenticated USING (user_is_guild_admin(guild_id));

-- ── custom_commands ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS auth_select_custom_commands ON custom_commands;
DROP POLICY IF EXISTS auth_insert_custom_commands ON custom_commands;
DROP POLICY IF EXISTS auth_update_custom_commands ON custom_commands;
DROP POLICY IF EXISTS auth_delete_custom_commands ON custom_commands;

CREATE POLICY select_custom_commands ON custom_commands FOR SELECT
  TO authenticated USING (user_in_guild(guild_id));
CREATE POLICY insert_custom_commands ON custom_commands FOR INSERT
  TO authenticated WITH CHECK (user_is_guild_admin(guild_id));
CREATE POLICY update_custom_commands ON custom_commands FOR UPDATE
  TO authenticated USING (user_is_guild_admin(guild_id))
  WITH CHECK (user_is_guild_admin(guild_id));
CREATE POLICY delete_custom_commands ON custom_commands FOR DELETE
  TO authenticated USING (user_is_guild_admin(guild_id));

-- ── reaction_role_groups ────────────────────────────────────────────────────
DROP POLICY IF EXISTS auth_select_rrg ON reaction_role_groups;
DROP POLICY IF EXISTS auth_insert_rrg ON reaction_role_groups;
DROP POLICY IF EXISTS auth_update_rrg ON reaction_role_groups;
DROP POLICY IF EXISTS auth_delete_rrg ON reaction_role_groups;

CREATE POLICY select_rrg ON reaction_role_groups FOR SELECT
  TO authenticated USING (user_in_guild(guild_id));
CREATE POLICY insert_rrg ON reaction_role_groups FOR INSERT
  TO authenticated WITH CHECK (user_is_guild_admin(guild_id));
CREATE POLICY update_rrg ON reaction_role_groups FOR UPDATE
  TO authenticated USING (user_is_guild_admin(guild_id))
  WITH CHECK (user_is_guild_admin(guild_id));
CREATE POLICY delete_rrg ON reaction_role_groups FOR DELETE
  TO authenticated USING (user_is_guild_admin(guild_id));

-- ── reaction_roles (no guild_id — joins through reaction_role_groups) ────────
DROP POLICY IF EXISTS auth_select_rr ON reaction_roles;
DROP POLICY IF EXISTS auth_insert_rr ON reaction_roles;
DROP POLICY IF EXISTS auth_update_rr ON reaction_roles;
DROP POLICY IF EXISTS auth_delete_rr ON reaction_roles;

CREATE POLICY select_rr ON reaction_roles FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM reaction_role_groups
      WHERE reaction_role_groups.id = reaction_roles.group_id
        AND user_in_guild(reaction_role_groups.guild_id)
    )
  );
CREATE POLICY insert_rr ON reaction_roles FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM reaction_role_groups
      WHERE reaction_role_groups.id = group_id
        AND user_is_guild_admin(reaction_role_groups.guild_id)
    )
  );
CREATE POLICY update_rr ON reaction_roles FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM reaction_role_groups
      WHERE reaction_role_groups.id = reaction_roles.group_id
        AND user_is_guild_admin(reaction_role_groups.guild_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM reaction_role_groups
      WHERE reaction_role_groups.id = reaction_roles.group_id
        AND user_is_guild_admin(reaction_role_groups.guild_id)
    )
  );
CREATE POLICY delete_rr ON reaction_roles FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM reaction_role_groups
      WHERE reaction_role_groups.id = reaction_roles.group_id
        AND user_is_guild_admin(reaction_role_groups.guild_id)
    )
  );

-- ── ticket_configs ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS auth_select_ticket_configs ON ticket_configs;
DROP POLICY IF EXISTS auth_insert_ticket_configs ON ticket_configs;
DROP POLICY IF EXISTS auth_update_ticket_configs ON ticket_configs;
DROP POLICY IF EXISTS auth_delete_ticket_configs ON ticket_configs;

CREATE POLICY select_ticket_configs ON ticket_configs FOR SELECT
  TO authenticated USING (user_in_guild(guild_id));
CREATE POLICY insert_ticket_configs ON ticket_configs FOR INSERT
  TO authenticated WITH CHECK (user_is_guild_admin(guild_id));
CREATE POLICY update_ticket_configs ON ticket_configs FOR UPDATE
  TO authenticated USING (user_is_guild_admin(guild_id))
  WITH CHECK (user_is_guild_admin(guild_id));
CREATE POLICY delete_ticket_configs ON ticket_configs FOR DELETE
  TO authenticated USING (user_is_guild_admin(guild_id));

-- ── tickets ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS auth_select_tickets ON tickets;
DROP POLICY IF EXISTS auth_insert_tickets ON tickets;
DROP POLICY IF EXISTS auth_update_tickets ON tickets;
DROP POLICY IF EXISTS auth_delete_tickets ON tickets;

CREATE POLICY select_tickets ON tickets FOR SELECT
  TO authenticated USING (user_in_guild(guild_id));
CREATE POLICY insert_tickets ON tickets FOR INSERT
  TO authenticated WITH CHECK (user_is_guild_admin(guild_id));
CREATE POLICY update_tickets ON tickets FOR UPDATE
  TO authenticated USING (user_is_guild_admin(guild_id))
  WITH CHECK (user_is_guild_admin(guild_id));
CREATE POLICY delete_tickets ON tickets FOR DELETE
  TO authenticated USING (user_is_guild_admin(guild_id));

-- ── webhook_configs ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS auth_select_webhook_configs ON webhook_configs;
DROP POLICY IF EXISTS auth_insert_webhook_configs ON webhook_configs;
DROP POLICY IF EXISTS auth_update_webhook_configs ON webhook_configs;
DROP POLICY IF EXISTS auth_delete_webhook_configs ON webhook_configs;

CREATE POLICY select_webhook_configs ON webhook_configs FOR SELECT
  TO authenticated USING (user_in_guild(guild_id));
CREATE POLICY insert_webhook_configs ON webhook_configs FOR INSERT
  TO authenticated WITH CHECK (user_is_guild_admin(guild_id));
CREATE POLICY update_webhook_configs ON webhook_configs FOR UPDATE
  TO authenticated USING (user_is_guild_admin(guild_id))
  WITH CHECK (user_is_guild_admin(guild_id));
CREATE POLICY delete_webhook_configs ON webhook_configs FOR DELETE
  TO authenticated USING (user_is_guild_admin(guild_id));

-- ── welcome_config ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS auth_select_welcome_config ON welcome_config;
DROP POLICY IF EXISTS auth_insert_welcome_config ON welcome_config;
DROP POLICY IF EXISTS auth_update_welcome_config ON welcome_config;
DROP POLICY IF EXISTS auth_delete_welcome_config ON welcome_config;

CREATE POLICY select_welcome_config ON welcome_config FOR SELECT
  TO authenticated USING (user_in_guild(guild_id));
CREATE POLICY insert_welcome_config ON welcome_config FOR INSERT
  TO authenticated WITH CHECK (user_is_guild_admin(guild_id));
CREATE POLICY update_welcome_config ON welcome_config FOR UPDATE
  TO authenticated USING (user_is_guild_admin(guild_id))
  WITH CHECK (user_is_guild_admin(guild_id));
CREATE POLICY delete_welcome_config ON welcome_config FOR DELETE
  TO authenticated USING (user_is_guild_admin(guild_id));

-- ── bot_commands ────────────────────────────────────────────────────────────
-- Bot commands are readable by guild members, but only the bot (service role)
-- or owner can insert/update/delete.
DROP POLICY IF EXISTS select_bot_commands ON bot_commands;
DROP POLICY IF EXISTS insert_bot_commands ON bot_commands;
DROP POLICY IF EXISTS update_bot_commands ON bot_commands;
DROP POLICY IF EXISTS delete_bot_commands ON bot_commands;

CREATE POLICY select_bot_commands ON bot_commands FOR SELECT
  TO authenticated USING (user_in_guild(guild_id) OR user_is_owner());
CREATE POLICY insert_bot_commands ON bot_commands FOR INSERT
  TO authenticated WITH CHECK (user_is_owner());
CREATE POLICY update_bot_commands ON bot_commands FOR UPDATE
  TO authenticated USING (user_is_owner())
  WITH CHECK (user_is_owner());
CREATE POLICY delete_bot_commands ON bot_commands FOR DELETE
  TO authenticated USING (user_is_owner());

-- ── bot_config (singleton — owner only) ─────────────────────────────────────
DROP POLICY IF EXISTS auth_select_bot_config ON bot_config;
DROP POLICY IF EXISTS auth_update_bot_config ON bot_config;

CREATE POLICY select_bot_config ON bot_config FOR SELECT
  TO authenticated USING (user_is_owner());
CREATE POLICY update_bot_config ON bot_config FOR UPDATE
  TO authenticated USING (user_is_owner())
  WITH CHECK (user_is_owner());

-- ── bot_status (singleton — owner only for writes, readable by all auth) ────
DROP POLICY IF EXISTS select_bot_status_authenticated ON bot_status;

CREATE POLICY select_bot_status ON bot_status FOR SELECT
  TO authenticated USING (true);
CREATE POLICY update_bot_status ON bot_status FOR UPDATE
  TO authenticated USING (user_is_owner())
  WITH CHECK (user_is_owner());

-- ── app_users (owner/super_admin only) ──────────────────────────────────────
DROP POLICY IF EXISTS select_app_users_authenticated ON app_users;

CREATE POLICY select_app_users ON app_users FOR SELECT
  TO authenticated USING (user_id = auth.uid() OR user_is_owner());
CREATE POLICY update_app_users ON app_users FOR UPDATE
  TO authenticated USING (user_id = auth.uid() OR user_is_owner())
  WITH CHECK (user_id = auth.uid() OR user_is_owner());
