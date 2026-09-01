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

    // Wait for INITIAL_SESSION so magic-link tokens in the URL hash are
    // processed before we decide the user is logged out and redirect to /.
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (event === 'INITIAL_SESSION') {
        if (session) await refresh();
        if (mounted) setLoading(false);
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        await refresh();
        if (mounted) setLoading(false);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        if (mounted) setLoading(false);
      }
    });

    // Safety fallback — if INITIAL_SESSION never fires within 1.5s, unblock
    // the UI. INITIAL_SESSION normally fires almost immediately (it's a
    // local storage read, not a network round-trip in the common case), so
    // this is a worst-case ceiling, not the typical wait — 4s was making a
    // rare edge case the default experience for the "Sign in" button.
    const timeout = setTimeout(() => {
      if (mounted) {
        setLoading(false);
      }
    }, 1500);

    return () => {
      mounted = false;
      clearTimeout(timeout);
      sub.subscription.unsubscribe();
    };
  }, [refresh]);

  const signIn = useCallback(async () => {
    setLoading(true);
    try {
      // If Discord OAuth2 is configured, redirect to the OAuth2 signin route
      // which will redirect to Discord and back to the callback.
      // Falls back to demo auth if OAuth2 env vars are not set.
      if (process.env.NEXT_PUBLIC_USE_DISCORD_OAUTH === 'true') {
        window.location.href = '/api/auth/signin';
        return;
      }

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
