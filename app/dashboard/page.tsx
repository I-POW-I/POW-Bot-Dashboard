'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bot, ChevronRight, Search } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { fetchGuildConfig } from '@/lib/data';
import type { GuildConfig } from '@/types';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function DashboardIndex() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [guilds, setGuilds] = useState<GuildConfig[]>([]);
  const [query, setQuery] = useState('');
  const [loadingGuilds, setLoadingGuilds] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        // Promise.allSettled, not Promise.all — one guild's config fetch
        // throwing previously meant NONE of them resolved, leaving
        // loadingGuilds stuck true forever (the skeleton loader spinning
        // indefinitely, which looked like blank/broken cards).
        const results = await Promise.allSettled(
          user.guilds.map((g) => fetchGuildConfig(g.guildId))
        );
        if (cancelled) return;
        const configs = results
          .filter((r): r is PromiseFulfilledResult<GuildConfig | null> => r.status === 'fulfilled')
          .map((r) => r.value)
          .filter(Boolean) as GuildConfig[];
        setGuilds(configs);
      } finally {
        if (!cancelled) setLoadingGuilds(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Bot className="h-5 w-5 animate-pulse text-primary" />
          <span>Loading dashboard…</span>
        </div>
      </div>
    );
  }

  const filtered = guilds.filter((g) =>
    (g.guild_name || '').toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-20" />
      <div className="pointer-events-none absolute inset-0 bg-radial-glow" />
      <div className="relative mx-auto max-w-5xl px-6 py-16">
        <div className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Your servers
          </h1>
          <p className="mt-2 text-muted-foreground">
            Pick a server to manage its 24/7 POW Bot configuration.
          </p>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search servers…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-11 pl-10"
          />
        </div>

        {loadingGuilds ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {[1, 2].map((i) => (
              <Card key={i} className="h-24 animate-pulse bg-card/40" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="p-12 text-center">
            <Bot className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">
              No servers found. Make sure the bot has been invited to your server.
            </p>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {filtered.map((g) => {
              const role =
                user.guilds.find((m) => m.guildId === g.guild_id)?.role ||
                'viewer';
              return (
                <Card
                  key={g.guild_id}
                  className="group cursor-pointer p-5 transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
                  onClick={() => router.push(`/dashboard/${g.guild_id}`)}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-chart-4 to-primary text-lg font-semibold text-primary-foreground">
                      {g.guild_icon ? (
                        <img
                          src={`https://cdn.discordapp.com/icons/${g.guild_id}/${g.guild_icon}.png`}
                          alt={g.guild_name || 'Guild'}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        (g.guild_name || 'G')[0]?.toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold text-foreground">
                        {g.guild_name || 'Unnamed server'}
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className="capitalize text-muted-foreground"
                        >
                          {role}
                        </Badge>
                        {g.target_voice_channel_id && (
                          <Badge
                            variant="outline"
                            className="border-success/30 bg-success/10 text-success"
                          >
                            24/7 active
                          </Badge>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        <div className="mt-12 flex items-center justify-between rounded-xl border border-border/60 bg-card/40 p-5">
          <div>
            <div className="text-sm font-medium text-foreground">
              Signed in as {user.globalName || user.username}
            </div>
            <div className="text-xs text-muted-foreground">
              Global role: {user.globalRole}
            </div>
          </div>
          <Button variant="outline" onClick={() => router.push('/owner')} disabled={user.globalRole !== 'owner'}>
            Owner Panel
          </Button>
        </div>
      </div>
    </div>
  );
}
