-- Revoke EXECUTE on the RLS helper functions from anon and authenticated.
-- These functions are only used inside RLS policy expressions, not called
-- directly by clients. SECURITY DEFINER is needed so they can read
-- guild_members/dashboard_users regardless of the calling role's permissions.

REVOKE EXECUTE ON FUNCTION public.user_in_guild(text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.user_is_guild_admin(text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.user_is_owner() FROM anon, authenticated;
