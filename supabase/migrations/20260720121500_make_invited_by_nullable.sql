/*
# Make invitations.invited_by nullable for demo seeding

## Overview
The `invited_by` column on `invitations` was NOT NULL with a default of
auth.uid(). For demo seeding (where no auth user exists yet), we need to
insert rows without an inviter. This migration drops the NOT NULL constraint
and the foreign key, replacing it with a nullable foreign key.

## Changes
- `invitations.invited_by` becomes nullable (keeps the FK to auth.users
  with ON DELETE SET NULL).
*/

ALTER TABLE invitations
  DROP CONSTRAINT IF EXISTS invitations_invited_by_fkey;

ALTER TABLE invitations
  ALTER COLUMN invited_by DROP NOT NULL;

ALTER TABLE invitations
  ADD CONSTRAINT invitations_invited_by_fkey
  FOREIGN KEY (invited_by) REFERENCES auth.users(id) ON DELETE SET NULL;
