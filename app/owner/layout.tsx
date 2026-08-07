'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bot, Sparkles } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const OWNER_NAV = [
  { href: '/owner', label: 'Global Overview', exact: true },
  { href: '/owner/admin', label: 'Admin Panel' },
  { href: '/owner/servers', label: 'Servers' },
  { href: '/owner/users', label: 'Users' },
  { href: '/owner/announcements', label: 'Announcements' },
  { href: '/owner/controls', label: 'Bot Controls' },
];

export default function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace('/');
    if (!loading && user && user.globalRole !== 'owner') router.replace('/dashboard');
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Bot className="h-6 w-6 animate-pulse text-primary" />
      </div>
    );
  }

  if (user.globalRole !== 'owner') return null;

  return (
    <div className="min-h-screen bg-background">
      <div className="pointer-events-none fixed inset-0 bg-grid opacity-20" />
      <div className="pointer-events-none fixed inset-0 bg-radial-glow" />
      <div className="relative">
        <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-chart-4 to-primary shadow-md shadow-chart-4/20">
                <Sparkles className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">
                  Owner Panel
                </div>
                <div className="text-xs text-muted-foreground">
                  God-mode across all servers
                </div>
              </div>
            </div>
            <Link
              href="/dashboard"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Exit to dashboard →
            </Link>
          </div>
          <div className="mx-auto max-w-7xl px-6 pb-3">
            <nav className="flex gap-1 overflow-x-auto scrollbar-thin">
              {OWNER_NAV.map((item) => {
                const active = item.exact
                  ? pathname === item.href
                  : pathname?.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap',
                      active
                        ? 'bg-chart-4/10 text-chart-4'
                        : 'text-muted-foreground hover:bg-accent/10 hover:text-foreground'
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
