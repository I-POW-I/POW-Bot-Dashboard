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
      // Force the browser to bypass environmental checks and go straight to Discord auth
      window.location.href = '/api/auth/signin';
    } catch (error) {
      console.error("Navigation redirect failed:", error);
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
