-- Revoke EXECUTE from PUBLIC (the default grant that includes anon + authenticated).
-- SECURITY DEFINER functions need this so they can read guild_members during
-- RLS evaluation without being directly callable via the REST API.
REVOKE EXECUTE ON FUNCTION public.user_in_guild(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.user_is_guild_admin(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.user_is_owner() FROM PUBLIC;
