'use client';

import { useEffect, useState } from 'react';
import {
  Activity,
  Bot,
  Clock,
  Cpu,
  Radio,
  Server,
  Users,
  Zap,
} from 'lucide-react';
import { fetchBotStatus, fetchGuildConfig, formatUptime, relativeTime } from '@/lib/data';
import { useAuth } from '@/components/providers/auth-provider';
import type { BotStatus, GuildConfig } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function OwnerOverview() {
  const { user } = useAuth();
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [guilds, setGuilds] = useState<GuildConfig[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const s = await fetchBotStatus();
      if (cancelled) return;
      setStatus(s);

      // Previously this listed EVERY server the logged-in admin can manage
      // on Discord (user.guilds) and labelled it "servers the bot is in" —
      // those aren't the same list. Filter down to guilds the bot actually
      // reports being in via its heartbeat.
      const botGuildIds = new Set(s?.guild_ids || []);
      const relevantGuilds = user.guilds.filter((g) => botGuildIds.has(g.guildId));

      const results = await Promise.allSettled(
        relevantGuilds.map((g) => fetchGuildConfig(g.guildId))
      );
      if (cancelled) return;
      const configs = results
        .filter((r): r is PromiseFulfilledResult<GuildConfig | null> => r.status === 'fulfilled')
        .map((r) => r.value)
        .filter(Boolean) as GuildConfig[];
      setGuilds(configs);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Bot className="h-6 w-6 animate-pulse text-chart-4" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Global Overview
        </h1>
        <p className="text-sm text-muted-foreground">
          Live view across every server the bot is in.
        </p>
      </div>

      {/* Top counters */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="glass p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Server className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Total servers</div>
              <div className="text-2xl font-bold text-foreground">
                {status?.total_guilds ?? 0}
              </div>
            </div>
          </div>
        </Card>
        <Card className="glass p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-chart-4/10 text-chart-4">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Total members</div>
              <div className="text-2xl font-bold text-foreground">
                {(status?.total_members ?? 0).toLocaleString()}
              </div>
            </div>
          </div>
        </Card>
        <Card className="glass p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-success/10 text-success">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Active VCs</div>
              <div className="text-2xl font-bold text-foreground">
                {status?.active_connections ?? 0}
              </div>
            </div>
          </div>
        </Card>
        <Card className="glass p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-chart-3/10 text-chart-3">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Process uptime</div>
              <div className="text-2xl font-bold text-foreground">
                {formatUptime(status?.process_uptime_ms)}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Process metrics */}
      <Card className="glass">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Process metrics</CardTitle>
              <CardDescription>Live runtime stats</CardDescription>
            </div>
            <Badge
              variant="outline"
              className={cn(
                'gap-1.5',
                status?.online
                  ? 'border-success/30 bg-success/10 text-success'
                  : 'border-destructive/30 bg-destructive/10 text-destructive'
              )}
            >
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  status?.online ? 'bg-success' : 'bg-destructive'
                )}
              />
              {status?.online ? 'Online' : 'Offline'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-border/60 bg-background-elevated/40 p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Cpu className="h-3.5 w-3.5" /> Memory
              </div>
              <div className="mt-1 text-lg font-semibold text-foreground">
                {status?.memory_mb.toFixed(1) ?? '—'} MB
              </div>
            </div>
            <div className="rounded-lg border border-border/60 bg-background-elevated/40 p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Zap className="h-3.5 w-3.5" /> Gateway ping
              </div>
              <div className="mt-1 text-lg font-semibold text-foreground">
                {status?.ping_ms ?? '—'} ms
              </div>
            </div>
            <div className="rounded-lg border border-border/60 bg-background-elevated/40 p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Radio className="h-3.5 w-3.5" /> Presence
              </div>
              <div className="mt-1 truncate text-sm font-medium text-foreground">
                {status?.presence_activity || '—'}
              </div>
            </div>
            <div className="rounded-lg border border-border/60 bg-background-elevated/40 p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" /> Updated
              </div>
              <div className="mt-1 text-sm font-medium text-foreground">
                {relativeTime(status?.updated_at)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Server list */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-base">All servers</CardTitle>
          <CardDescription>
            {guilds.length} server(s) the bot is currently in
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {guilds.map((g) => (
              <div
                key={g.guild_id}
                className="flex items-center gap-4 rounded-lg border border-border/60 bg-background-elevated/40 p-3"
              >
                <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-chart-4 to-primary text-sm font-semibold text-primary-foreground">
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
                  <div className="truncate font-medium text-foreground">
                    {g.guild_name || 'Unnamed server'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    ID: {g.guild_id} · Joined {relativeTime(g.joined_at)}
                  </div>
                </div>
                {g.target_voice_channel_id ? (
                  <Badge
                    variant="outline"
                    className="border-success/30 bg-success/10 text-success"
                  >
                    24/7 active
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground">
                    Idle
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
