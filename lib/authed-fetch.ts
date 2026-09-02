import { supabase } from '@/lib/supabase';

/**
 * Fetch wrapper for calling this app's own API routes that are protected
 * by requireUser/requireGuildMember/requireGuildAdmin (lib/server-auth.ts).
 * Those all expect `Authorization: Bearer <supabase-access-token>` — this
 * was never actually being attached anywhere in the app, which is why
 * calls to protected routes were returning 401 regardless of whether the
 * person was really signed in.
 */
export async function authedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  return fetch(url, {
    ...init,
    headers: {
      ...(init.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}
