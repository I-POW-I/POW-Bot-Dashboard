'use client';

import {
  Activity,
  Radio,
  Settings,
  ShieldCheck,
  Sparkles,
  Volume2,
} from 'lucide-react';
import type { AuditCategory, AuditLogEntry } from '@/types';
import { relativeTime } from '@/lib/data';
import { cn } from '@/lib/utils';

const CATEGORY_META: Record<
  AuditCategory,
  { icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  voice: { icon: Volume2, color: 'text-primary bg-primary/10' },
  logging: { icon: Activity, color: 'text-chart-2 bg-chart-2/10' },
  streamers: { icon: Radio, color: 'text-chart-4 bg-chart-4/10' },
  verification: { icon: ShieldCheck, color: 'text-warning bg-warning/10' },
  welcome: { icon: Sparkles, color: 'text-chart-3 bg-chart-3/10' },
  system: { icon: Settings, color: 'text-muted-foreground bg-muted' },
  announcement: { icon: Sparkles, color: 'text-chart-4 bg-chart-4/10' },
  blacklist: { icon: ShieldCheck, color: 'text-destructive bg-destructive/10' },
  presence: { icon: Activity, color: 'text-primary bg-primary/10' },
};

export function AuditFeed({ entries }: { entries: AuditLogEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        No recent activity.
      </div>
    );
  }
  return (
    <div className="space-y-1">
      {entries.map((e) => {
        const meta = CATEGORY_META[e.category] || CATEGORY_META.system;
        const Icon = meta.icon;
        return (
          <div
            key={e.id}
            className="group flex items-start gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-accent/10"
          >
            <div
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                meta.color
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-foreground">{e.action}</p>
              <p className="text-xs text-muted-foreground">
                {e.actor_username || 'system'} · {relativeTime(e.created_at)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
