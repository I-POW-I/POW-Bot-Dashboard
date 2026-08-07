'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { SessionUser } from '@/types';
import {
  getCurrentSessionUser,
  signInDemoUser,
  signOut as signOutFn,
} from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { NotificationProvider } from '@/components/providers/notification-provider';

interface AuthContextValue {
  user: SessionUser | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const u = await getCurrentSessionUser();
    setUser(u);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      await refresh();
      if (mounted) setLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        (async () => {
          await refresh();
        })();
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [refresh]);

  const signIn = useCallback(async () => {
    setLoading(true);
    try {
      // If Discord OAuth2 is configured, redirect to the OAuth2 signin route
      // which will redirect to Discord and back to the callback.
      // Falls back to demo auth if OAuth2 env vars are not set.
      const hasOAuth =
        process.env.NEXT_PUBLIC_DISCORD_OAUTH === 'true' ||
        (typeof window !== 'undefined' &&
          window.location.hostname !== 'localhost');

      if (hasOAuth && process.env.NEXT_PUBLIC_USE_DISCORD_OAUTH === 'true') {
        window.location.href = '/api/auth/signin';
        return;
      }

      // Demo auth fallback
      const u = await signInDemoUser();
      setUser(u);
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    await signOutFn();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, refresh }}>
      <NotificationProvider>{children}</NotificationProvider>
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
