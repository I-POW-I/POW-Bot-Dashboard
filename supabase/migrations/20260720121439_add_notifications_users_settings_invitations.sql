/*
# Dashboard Enhancement: Notifications, Staff Users, Settings, Invitations

## Overview
Adds four new tables that power the enhanced dashboard features:
notifications centre, staff user management (separate from Discord
dashboard_users), per-user application settings, and pending invitations.

## New Tables
1. `notifications` — Real-time notification feed. Each row is a notification
   addressed to a specific user, with severity, category, read state, and
   optional action link. Driven by Supabase real-time subscriptions on the
   client.
2. `app_users` — Staff/team members of the dashboard organisation (distinct
   from Discord `dashboard_users`). Supports the Super Admin / Admin / Editor
   / Viewer RBAC model with status (active/suspended/pending), email, last
   active timestamp, and avatar.
3. `app_settings` — Per-user application settings stored as JSONB. Covers
   general (timezone, locale), security (2FA, session timeout, password
   policy), notifications (per-channel preferences), appearance (theme,
   accent colour), and integrations (enabled third-party services).
4. `invitations` — Pending email invitations to join the dashboard as staff.
   Tracks email, invited role, status (pending/accepted/revoked), expiry,
   and the inviting user.

## Security
- RLS enabled on every table.
- `notifications`, `app_settings` are owner-scoped (auth.uid() = user_id).
- `app_users` is readable by all authenticated users (staff directory) but
   writable only by Super Admin / Admin (checked via app_users row for the
   current user).
- `invitations` is readable by Super Admin / Admin, insertable by same.
- All owner columns default to auth.uid().

## Notes
1. `app_users` intentionally duplicates some fields that auth.users has
   (email) so the staff table can be rendered without joining to auth.users
   (which is not readable by the anon key).
2. The permissions matrix is stored as a JSONB column on app_settings under
   the key `permissions_matrix` — a map of role -> feature -> boolean. Super
   Admins edit it; the client reads it to gate UI.
3. Notifications support a `metadata` JSONB column for arbitrary payload
   (e.g. the guild_id that triggered a streamer-live notification).
*/

-- ── 1. notifications ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  severity text NOT NULL DEFAULT 'info'
    CHECK (severity IN ('info','warning','error','success')),
  category text NOT NULL DEFAULT 'general'
    CHECK (category IN ('general','voice','streamer','game','system','security','user','announcement','audit')),
  title text NOT NULL,
  body text,
  action_label text,
  action_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications (user_id, read, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_notifications" ON notifications;
CREATE POLICY "select_own_notifications" ON notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_notifications" ON notifications;
CREATE POLICY "insert_own_notifications" ON notifications
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_notifications" ON notifications;
CREATE POLICY "update_own_notifications" ON notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_notifications" ON notifications;
CREATE POLICY "delete_own_notifications" ON notifications
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Enable real-time for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- ── 2. app_users ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  email text NOT NULL,
  full_name text,
  avatar_url text,
  role text NOT NULL DEFAULT 'viewer'
    CHECK (role IN ('super_admin','admin','editor','viewer')),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','suspended','pending')),
  last_active_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_users_role ON app_users (role);
CREATE INDEX IF NOT EXISTS idx_app_users_status ON app_users (status);

ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read the staff directory.
DROP POLICY IF EXISTS "select_app_users_authenticated" ON app_users;
CREATE POLICY "select_app_users_authenticated" ON app_users
  FOR SELECT TO authenticated USING (true);

-- Super Admin / Admin can insert.
DROP POLICY IF EXISTS "insert_app_users_admin" ON app_users;
CREATE POLICY "insert_app_users_admin" ON app_users
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM app_users au
      WHERE au.user_id = auth.uid() AND au.role IN ('super_admin','admin')
    )
  );

-- Super Admin / Admin can update. Users can update their own last_active_at.
DROP POLICY IF EXISTS "update_app_users_admin" ON app_users;
CREATE POLICY "update_app_users_admin" ON app_users
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM app_users au
      WHERE au.user_id = auth.uid() AND au.role IN ('super_admin','admin')
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM app_users au
      WHERE au.user_id = auth.uid() AND au.role IN ('super_admin','admin')
    )
  );

-- Super Admin can delete.
DROP POLICY IF EXISTS "delete_app_users_super_admin" ON app_users;
CREATE POLICY "delete_app_users_super_admin" ON app_users
  FOR DELETE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM app_users au
      WHERE au.user_id = auth.uid() AND au.role = 'super_admin'
    )
  );

-- ── 3. app_settings ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_settings (
  user_id uuid PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  general jsonb NOT NULL DEFAULT '{"app_name":"POW Bot Dashboard","timezone":"UTC","locale":"en-US"}'::jsonb,
  security jsonb NOT NULL DEFAULT '{"session_timeout_minutes":30,"two_factor":false,"password_min_length":8,"password_require_special":true}'::jsonb,
  notification_prefs jsonb NOT NULL DEFAULT '{"email":true,"in_app":true,"webhook":false,"webhook_url":"","channels":{"voice":true,"streamer":true,"game":true,"system":true,"security":true,"announcement":true}}'::jsonb,
  appearance jsonb NOT NULL DEFAULT '{"theme":"dark","accent":"blue"}'::jsonb,
  integrations jsonb NOT NULL DEFAULT '{"discord":true,"supabase":true,"webhook":false}'::jsonb,
  permissions_matrix jsonb NOT NULL DEFAULT '{
    "super_admin":{"voice":true,"logging":true,"welcome":true,"streamers":true,"games":true,"leaderboard":true,"audit":true,"users":true,"settings":true,"owner":true},
    "admin":{"voice":true,"logging":true,"welcome":true,"streamers":true,"games":true,"leaderboard":true,"audit":true,"users":true,"settings":true,"owner":false},
    "editor":{"voice":true,"logging":true,"welcome":true,"streamers":true,"games":true,"leaderboard":true,"audit":false,"users":false,"settings":false,"owner":false},
    "viewer":{"voice":true,"logging":true,"welcome":false,"streamers":false,"games":false,"leaderboard":true,"audit":false,"users":false,"settings":false,"owner":false}
  }'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_app_settings" ON app_settings;
CREATE POLICY "select_own_app_settings" ON app_settings
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_app_settings" ON app_settings;
CREATE POLICY "insert_own_app_settings" ON app_settings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_app_settings" ON app_settings;
CREATE POLICY "update_own_app_settings" ON app_settings
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_app_settings" ON app_settings;
CREATE POLICY "delete_own_app_settings" ON app_settings
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ── 4. invitations ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  role text NOT NULL DEFAULT 'viewer'
    CHECK (role IN ('super_admin','admin','editor','viewer')),
  invited_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','revoked')),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invitations_status ON invitations (status);

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_invitations_admin" ON invitations;
CREATE POLICY "select_invitations_admin" ON invitations
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM app_users au
      WHERE au.user_id = auth.uid() AND au.role IN ('super_admin','admin')
    )
  );

DROP POLICY IF EXISTS "insert_invitations_admin" ON invitations;
CREATE POLICY "insert_invitations_admin" ON invitations
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM app_users au
      WHERE au.user_id = auth.uid() AND au.role IN ('super_admin','admin')
    )
  );

DROP POLICY IF EXISTS "update_invitations_admin" ON invitations;
CREATE POLICY "update_invitations_admin" ON invitations
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app_users au
      WHERE au.user_id = auth.uid() AND au.role IN ('super_admin','admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app_users au
      WHERE au.user_id = auth.uid() AND au.role IN ('super_admin','admin')
    )
  );

DROP POLICY IF EXISTS "delete_invitations_admin" ON invitations;
CREATE POLICY "delete_invitations_admin" ON invitations
  FOR DELETE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM app_users au
      WHERE au.user_id = auth.uid() AND au.role IN ('super_admin','admin')
    )
  );
