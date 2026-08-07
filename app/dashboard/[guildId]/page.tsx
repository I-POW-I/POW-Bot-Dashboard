'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Activity,
  Bot,
  Clock,
  Cpu,
  Radio,
  RefreshCw,
  Server,
  Trash2,
  Users,
  Volume2,
  Zap,
} from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import {
  fetchAuditLog,
  fetchBotStatus,
  fetchGuildConfig,
  fetchVcSessions,
  formatMs,
  formatUptime,
  insertAuditLog,
  relativeTime,
} from '@/lib/data';
import type {
  AuditLogEntry,
  BotStatus,
  GuildConfig,
  VcSession,
} from '@/types';
import { StatCard } from '@/components/dashboard/stat-card';
import { ActivityChart } from '@/components/dashboard/activity-chart';
import { AuditFeed } from '@/components/dashboard/audit-feed';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function OverviewPage() {
  const params = useParams<{ guildId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const [config, setConfig] = useState<GuildConfig | null>(null);
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [sessions, setSessions] = useState<VcSession[]>([]);
  const [audit, setAudit] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !params?.guildId) return;
    (async () => {
      const [c, s, sess, a] = await Promise.all([
        fetchGuildConfig(params.guildId),
        fetchBotStatus(),
        fetchVcSessions(params.guildId, 1000),
        fetchAuditLog(params.guildId, 10),
      ]);
      setConfig(c);
      setStatus(s);
      setSessions(sess);
      setAudit(a);
      setLoading(false);
    })();
  }, [user, params?.guildId]);

  const stats = useMemo(() => {
    const totalSessions = sessions.length;
    const totalMs = sessions.reduce((sum, s) => sum + (s.duration_ms || 0), 0);
    const uniqueUsers = new Set(sessions.map((s) => s.user_discord_id)).size;
    const openSessions = sessions.filter((s) => !s.left_at).length;
    const last7 = sessions.filter(
      (s) => new Date(s.joined_at) > new Date(Date.now() - 7 * 86400000)
    ).length;
    return {
      totalSessions,
      totalMs,
      uniqueUsers,
      openSessions,
      last7,
    };
  }, [sessions]);

  const topCommands = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of sessions) {
      const key = s.channel_name || 'Unknown';
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [sessions]);

  const logAction = async (action: string, category: AuditLogEntry['category'], details: Record<string, unknown>) => {
    if (!user || !params?.guildId) return;
    await insertAuditLog({
      guild_id: params.guildId,
      actor_discord_id: user.discordId,
      actor_username: user.username,
      action,
      category,
      details,
    });
    const fresh = await fetchAuditLog(params.guildId, 10);
    setAudit(fresh);
  };

  const handleQuickAction = async (kind: 'restart' | 'clearcache' | 'sync') => {
    const labels = {
      restart: 'Restart bot in server',
      clearcache: 'Clear cache',
      sync: 'Force sync slash commands',
    };
    toast({ title: 'Action queued', description: labels[kind] });
    await logAction(labels[kind], 'system', { kind });
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Bot className="h-6 w-6 animate-pulse text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Overview
          </h2>
          <p className="text-sm text-muted-foreground">
            Live status and activity for {config?.guild_name || 'this server'}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => handleQuickAction('restart')}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Restart
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => handleQuickAction('clearcache')}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear cache
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => handleQuickAction('sync')}
          >
            <Zap className="h-3.5 w-3.5" />
            Sync slash commands
          </Button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Volume2}
          label="Bot status"
          value={status?.online ? 'Connected' : 'Sleeping'}
          hint={
            status?.online
              ? `${status.ping_ms}ms · ${status.active_connections} active VC(s)`
              : 'Not in any voice channel'
          }
          accent={status?.online ? 'success' : 'warning'}
        />
        <StatCard
          icon={Users}
          label="Members"
          value={(status?.total_members ?? 0).toLocaleString()}
          hint="Across all bot servers"
          accent="primary"
        />
        <StatCard
          icon={Clock}
          label="VC sessions (30d)"
          value={stats.totalSessions}
          hint={`${stats.last7} in the last 7 days`}
          accent="chart4"
        />
        <StatCard
          icon={Activity}
          label="Active in VC now"
          value={stats.openSessions}
          hint={`${stats.uniqueUsers} unique members tracked`}
          accent="chart3"
        />
      </div>

      {/* Bot process card */}
      <Card className="glass">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Bot process</CardTitle>
              <CardDescription>Live runtime metrics</CardDescription>
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
              {status?.online ? 'Healthy' : 'Down'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-border/60 bg-background-elevated/40 p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" /> Process uptime
              </div>
              <div className="mt-1 text-lg font-semibold text-foreground">
                {formatUptime(status?.process_uptime_ms)}
              </div>
            </div>
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
                <Zap className="h-3.5 w-3.5" /> WebSocket ping
              </div>
              <div className="mt-1 text-lg font-semibold text-foreground">
                {status?.ping_ms ?? '—'} ms
              </div>
            </div>
            <div className="rounded-lg border border-border/60 bg-background-elevated/40 p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Server className="h-3.5 w-3.5" /> Servers
              </div>
              <div className="mt-1 text-lg font-semibold text-foreground">
                {status?.total_guilds ?? '—'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activity chart + top channels */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="glass lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Voice activity</CardTitle>
            <CardDescription>VC sessions per day · last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <ActivityChart sessions={sessions} />
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-base">Top channels</CardTitle>
            <CardDescription>Most active voice channels this week</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {topCommands.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              topCommands.map(([name, count], i) => (
                <div key={name} className="flex items-center gap-3">
                  <div
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-md text-xs font-semibold',
                      i === 0
                        ? 'bg-primary/15 text-primary'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-foreground">
                      {name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {count} sessions
                    </div>
                  </div>
                  <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{
                        width: `${(count / topCommands[0][1]) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Audit feed + 24/7 status */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="glass lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Recent activity</CardTitle>
                <CardDescription>Last 10 dashboard actions</CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push(`/dashboard/${params?.guildId}/audit`)}
              >
                View all
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <AuditFeed entries={audit} />
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-base">24/7 connection</CardTitle>
            <CardDescription>Voice channel status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-border/60 bg-background-elevated/40 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Status</span>
                <Badge
                  variant="outline"
                  className={
                    config?.target_voice_channel_id
                      ? 'border-success/30 bg-success/10 text-success'
                      : 'border-muted bg-muted text-muted-foreground'
                  }
                >
                  {config?.target_voice_channel_id ? 'Connected' : 'Idle'}
                </Badge>
              </div>
              <div className="mt-3 text-sm font-medium text-foreground">
                {config?.target_voice_channel_id
                  ? 'Voice channel locked'
                  : 'Not parked in a VC'}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Reconnects: {config?.reconnect_count ?? 0} · Joined{' '}
                {relativeTime(config?.joined_at)}
              </div>
            </div>
            <Button
              className="w-full gap-2"
              onClick={() => router.push(`/dashboard/${params?.guildId}/voice`)}
            >
              <Volume2 className="h-4 w-4" />
              Manage 24/7 voice
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
