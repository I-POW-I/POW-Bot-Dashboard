'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bot, Command, Search, Wifi } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Command as CommandPrimitive,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { fetchBotStatus } from '@/lib/data';
import { NotificationCentre } from '@/components/dashboard/notification-centre';
import { Breadcrumbs } from '@/components/dashboard/breadcrumbs';
import type { BotStatus } from '@/types';
import { cn } from '@/lib/utils';

export function Navbar({ guildName, guildId }: { guildName: string; guildId?: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<BotStatus | null>(null);

  useEffect(() => {
    const t = setInterval(async () => {
      const s = await fetchBotStatus();
      if (s) setStatus(s);
    }, 15000);
    (async () => {
      const s = await fetchBotStatus();
      if (s) setStatus(s);
    })();
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const online = status?.online ?? true;
  const ping = status?.ping_ms ?? 0;

  const searchItems = useMemo(() => {
    const items: { label: string; href: string; group: string }[] = [];
    if (user) {
      for (const g of user.guilds) {
        items.push({ label: `Server ${g.guildId.slice(0, 6)}`, href: `/dashboard/${g.guildId}`, group: 'Servers' });
        items.push({ label: 'Overview', href: `/dashboard/${g.guildId}`, group: 'Pages' });
        items.push({ label: '24/7 Voice', href: `/dashboard/${g.guildId}/voice`, group: 'Pages' });
        items.push({ label: 'Log Channels', href: `/dashboard/${g.guildId}/logging`, group: 'Pages' });
        items.push({ label: 'Welcome & Verify', href: `/dashboard/${g.guildId}/welcome`, group: 'Pages' });
        items.push({ label: 'Streamer Alerts', href: `/dashboard/${g.guildId}/streamers`, group: 'Pages' });
        items.push({ label: 'Game Alerts', href: `/dashboard/${g.guildId}/games`, group: 'Pages' });
        items.push({ label: 'VC Leaderboard', href: `/dashboard/${g.guildId}/leaderboard`, group: 'Pages' });
        items.push({ label: 'Audit Log', href: `/dashboard/${g.guildId}/audit`, group: 'Pages' });
      }
      items.push({ label: 'Analytics', href: '/analytics', group: 'Pages' });
      items.push({ label: 'User Management', href: '/users', group: 'Pages' });
      items.push({ label: 'Settings', href: '/settings', group: 'Pages' });
      if (user.globalRole === 'owner') {
        items.push({ label: 'Owner Panel', href: '/owner', group: 'Pages' });
        items.push({ label: 'Owner — Servers', href: '/owner/servers', group: 'Pages' });
        items.push({ label: 'Owner — Users', href: '/owner/users', group: 'Pages' });
        items.push({ label: 'Owner — Announcements', href: '/owner/announcements', group: 'Pages' });
        items.push({ label: 'Owner — Bot Controls', href: '/owner/controls', group: 'Pages' });
      }
    }
    return items;
  }, [user]);

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border/60 bg-background/70 px-6 backdrop-blur-xl">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-foreground">{guildName}</h1>
            <Badge
              variant="outline"
              className={cn(
                'gap-1.5 border-transparent py-1',
                online
                  ? 'bg-success/10 text-success'
                  : 'bg-destructive/10 text-destructive'
              )}
            >
              <span className="relative flex h-2 w-2">
                {online && (
                  <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-success" />
                )}
                <span
                  className={cn(
                    'relative inline-flex h-2 w-2 rounded-full',
                    online ? 'bg-success' : 'bg-destructive'
                  )}
                />
              </span>
              {online ? `Online · ${ping}ms` : 'Offline'}
            </Badge>
          </div>
          <Breadcrumbs guildName={guildId ? guildName : undefined} />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            className="hidden h-9 gap-2 px-3 text-muted-foreground md:flex"
            onClick={() => setOpen(true)}
          >
            <Search className="h-4 w-4" />
            <span className="text-sm">Search…</span>
            <kbd className="ml-2 flex h-5 items-center gap-0.5 rounded border border-border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
              <Command className="h-3 w-3" />K
            </kbd>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 md:hidden"
            onClick={() => setOpen(true)}
          >
            <Search className="h-4 w-4" />
          </Button>
          <NotificationCentre />
          <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/40 px-3 py-1.5">
            <Bot className="h-4 w-4 text-primary" />
            <span className="hidden text-sm font-medium text-foreground lg:inline">
              {user?.globalName || user?.username || 'User'}
            </span>
            <Wifi className={cn('h-3.5 w-3.5', online ? 'text-success' : 'text-destructive')} />
          </div>
        </div>
      </header>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="overflow-hidden p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Global search</DialogTitle>
          </DialogHeader>
          <CommandPrimitive className="bg-background">
            <CommandInput placeholder="Search pages, servers, settings…" />
            <CommandList className="max-h-[400px]">
              <CommandEmpty>No results found.</CommandEmpty>
              {['Servers', 'Pages'].map((group) => {
                const items = searchItems.filter((i) => i.group === group);
                if (items.length === 0) return null;
                return (
                  <CommandGroup key={group} heading={group}>
                    {items.map((item) => (
                      <CommandItem
                        key={item.href}
                        onSelect={() => {
                          setOpen(false);
                          router.push(item.href);
                        }}
                      >
                        <Search className="mr-2 h-4 w-4" />
                        {item.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                );
              })}
            </CommandList>
          </CommandPrimitive>
        </DialogContent>
      </Dialog>
    </>
  );
}
