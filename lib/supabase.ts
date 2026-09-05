import { createClient, SupabaseClient } from '@supabase/supabase-js';

const PLACEHOLDER_URL = 'https://placeholder.supabase.co';
const PLACEHOLDER_KEY = 'placeholder-anon-key';

function resolveUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    PLACEHOLDER_URL
  );
}

function resolveAnonKey(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    PLACEHOLDER_KEY
  );
}

let browserClient: SupabaseClient | null = null;

export const supabase: SupabaseClient = new Proxy(
  {} as SupabaseClient,
  {
    get(_target, prop) {
      if (!browserClient) {
        const url = resolveUrl();
        const key = resolveAnonKey();
        if (url === PLACEHOLDER_URL || key === PLACEHOLDER_KEY) {
          console.warn(
            '[supabase] Missing env vars — dashboard will not be able to read/write data.'
          );
        }
        browserClient = createClient(url, key, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            // Explicit rather than relying on the SDK default — this is
            // what actually reads the magic-link session tokens out of the
            // URL hash after the Discord OAuth redirect and stores them
            // for future page loads. Without this working correctly, every
            // page load looks like a fresh, logged-out visit.
            detectSessionInUrl: true,
          },
        });
      }
      const value = (browserClient as unknown as Record<string | symbol, unknown>)[prop];
      return typeof value === 'function' ? value.bind(browserClient) : value;
    },
  }
);

export const supabaseServer = (): SupabaseClient => {
  const url = process.env.SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !serviceKey) {
    throw new Error('Server Supabase client requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
};
