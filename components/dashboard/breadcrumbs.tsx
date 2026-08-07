'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

const LABEL_MAP: Record<string, string> = {
  dashboard: 'Servers',
  voice: '24/7 Voice',
  logging: 'Log Channels',
  welcome: 'Welcome & Verify',
  streamers: 'Streamer Alerts',
  games: 'Game Alerts',
  leaderboard: 'VC Leaderboard',
  audit: 'Audit Log',
  owner: 'Owner Panel',
  servers: 'Servers',
  users: 'User Management',
  settings: 'Settings',
  analytics: 'Analytics',
  announcements: 'Announcements',
  controls: 'Bot Controls',
};

export function Breadcrumbs({ guildName }: { guildName?: string }) {
  const pathname = usePathname();
  if (!pathname) return null;
  const segments = pathname.split('/').filter(Boolean);

  const crumbs: { label: string; href: string | null }[] = [];
  let href = '';
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    href += `/${seg}`;
    if (i === 1 && guildName && segments[0] === 'dashboard') {
      crumbs.push({ label: guildName, href });
    } else if (LABEL_MAP[seg]) {
      crumbs.push({ label: LABEL_MAP[seg], href });
    } else if (i > 0 && segments[i - 1] === 'dashboard') {
      crumbs.push({ label: `Server ${seg.slice(0, 6)}…`, href });
    } else {
      crumbs.push({ label: seg, href });
    }
  }

  if (crumbs.length === 0) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-1 text-xs text-muted-foreground"
    >
      <Link
        href="/dashboard"
        className="flex items-center gap-1 transition-colors hover:text-foreground"
      >
        <Home className="h-3 w-3" />
      </Link>
      {crumbs.map((c, i) => (
        <span key={i} className="flex items-center gap-1">
          <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
          {c.href && i < crumbs.length - 1 ? (
            <Link
              href={c.href}
              className="transition-colors hover:text-foreground"
            >
              {c.label}
            </Link>
          ) : (
            <span className={cn('font-medium text-foreground')}>
              {c.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
