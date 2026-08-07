'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Activity,
  AlertTriangle,
  Clock,
  Headphones,
  LogOut,
  Mic,
  Radio,
  RefreshCw,
  Server,
  Volume2,
  Zap,
} from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import {
  fetchBotStatus,
  fetchGuildConfig,
  fetchVcSessions,
  formatMs,
  formatUptime,
  insertAuditLog,
  relativeTime,
} from '@/lib/data';
import type { BotStatus, GuildConfig, VcSession } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

const DEMO_VOICE_CHANNELS = [
  { id: '9182736451029395', name: 'Lounge VC', type: 'voice' },
  { id: '9182736451029396', name: 'Music Room', type: 'voice' },
  { id: '9182736451029397', name: 'AFK', type: 'voice' },
  { id: '9182736451029398', name: 'Stage Main', type: 'stage' },
  { id: '9182736451029399', name: 'Gaming', type: 'voice' },
];

export default function VoicePage() {
  const params = useParams<{ guildId: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const [config, setConfig] = useState<GuildConfig | null>(null);
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [sessions, setSessions] = useState<VcSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChannel, setSelectedChannel] = useState<string>('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user || !params?.guildId) return;
    (async () => {
      const [c, s, sess] = await Promise.all([
        fetchGuildConfig(params.guildId),
        fetchBotStatus(),
        fetchVcSessions(params.guildId, 200),
      ]);
      setConfig(c);
      setStatus(s);
      setSessions(sess);
      setSelectedChannel(c?.target_voice_channel_id || '');
      setLoading(false);
    })();
  }, [user, params?.guildId]);

  const activeMembers = useMemo(
    () => sessions.filter((s) => !s.left_at),
    [sessions]
  );

  const logAction = async (action: string, details: Record<string, unknown>) => {
    if (!user || !params?.guildId) return;
    await insertAuditLog({
      guild_id: params.guildId,
      actor_discord_id: user.discordId,
      actor_username: user.username,
      action,
      category: 'voice',
      details,
    });
  };

  const updateConfig = async (updates: Partial<GuildConfig>) => {
    if (!params?.guildId) return;
    const { error } = await supabase
      .from('guild_configs')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('guild_id', params.guildId);
    if (error) {
      toast({
        title: 'Update failed',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    }
    const fresh = await fetchGuildConfig(params.guildId);
    setConfig(fresh);
    return true;
  };

  const handleJoin = async () => {
    if (!selectedChannel) {
      toast({ title: 'Pick a channel first', variant: 'destructive' });
      return;
    }
    setBusy(true);
    const channel = DEMO_VOICE_CHANNELS.find((c) => c.id === selectedChannel);
    const ok = await updateConfig({
      target_voice_channel_id: selectedChannel,
      last_channel_id: selectedChannel,
      joined_at: new Date().toISOString(),
    });
    if (ok) {
      toast({
        title: 'Joined voice channel',
        description: `Bot is now parked in ${channel?.name}.`,
      });
      await logAction(`Joined voice channel "${channel?.name}"`, {
        channel: channel?.name,
        channelId: selectedChannel,
      });
    }
    setBusy(false);
  };

  const handleLeave = async () => {
    setBusy(true);
    const ok = await updateConfig({
      target_voice_channel_id: null,
      last_channel_id: null,
    });
    if (ok) {
      toast({ title: 'Left voice channel', description: 'Clean disconnect.' });
      await logAction('Left voice channel (clean)', {});
    }
    setBusy(false);
  };

  const handleForceLeave = async () => {
    setBusy(true);
    const ok = await updateConfig({
      target_voice_channel_id: null,
      last_channel_id: null,
      joined_at: null,
      reconnect_count: 0,
    });
    if (ok) {
      toast({
        title: 'Force-leave complete',
        description: 'All connection state wiped.',
      });
      await logAction('Force-left voice channel (ghost reset)', {
        reason: 'ghost',
      });
    }
    setBusy(false);
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Headphones className="h-6 w-6 animate-pulse text-primary" />
      </div>
    );
  }

  const isConnected = !!config?.target_voice_channel_id;
  const currentChannel = DEMO_VOICE_CHANNELS.find(
    (c) => c.id === config?.target_voice_channel_id
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          24/7 Voice
        </h2>
        <p className="text-sm text-muted-foreground">
          The core feature — park the bot in a voice channel and keep it there
          forever.
        </p>
      </div>

      {/* Now playing / connection status */}
      <Card className="glass relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-radial-glow" />
        <CardContent className="relative p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-5">
              <div className="relative">
                <div
                  className={cn(
                    'flex h-20 w-20 items-center justify-center rounded-2xl shadow-lg',
                    isConnected
                      ? 'bg-gradient-to-br from-success to-chart-2 shadow-success/20'
                      : 'bg-gradient-to-br from-muted to-secondary'
                  )}
                >
                  <Volume2
                    className={cn(
                      'h-10 w-10',
                      isConnected ? 'text-success-foreground' : 'text-muted-foreground'
                    )}
                  />
                </div>
                {isConnected && (
                  <span className="absolute -bottom-1 -right-1 flex h-6 w-6">
                    <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-success" />
                    <span className="relative inline-flex h-6 w-6 rounded-full border-2 border-card bg-success" />
                  </span>
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Now connected to
                  </span>
                  {isConnected && (
                    <Badge
                      variant="outline"
                      className="border-success/30 bg-success/10 text-success"
                    >
                      24/7 active
                    </Badge>
                  )}
                </div>
                <h3 className="mt-1 text-2xl font-bold text-foreground">
                  {currentChannel?.name || 'No channel'}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {isConnected
                    ? `Joined ${relativeTime(config?.joined_at)} · ${config?.reconnect_count ?? 0} reconnect(s)`
                    : 'The bot is sleeping — pick a channel below to start 24/7 mode.'}
                </p>
              </div>
            </div>

            {isConnected && (
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-border/60 bg-background-elevated/40 px-4 py-3 text-center">
                  <div className="text-xs text-muted-foreground">Uptime</div>
                  <div className="mt-0.5 text-lg font-semibold text-foreground">
                    {formatUptime(
                      config?.joined_at
                        ? Date.now() - new Date(config.joined_at).getTime()
                        : 0
                    )}
                  </div>
                </div>
                <div className="rounded-lg border border-border/60 bg-background-elevated/40 px-4 py-3 text-center">
                  <div className="text-xs text-muted-foreground">In VC</div>
                  <div className="mt-0.5 text-lg font-semibold text-foreground">
                    {activeMembers.length}
                  </div>
                </div>
                <div className="rounded-lg border border-border/60 bg-background-elevated/40 px-4 py-3 text-center">
                  <div className="text-xs text-muted-foreground">Ping</div>
                  <div className="mt-0.5 text-lg font-semibold text-foreground">
                    {status?.ping_ms ?? '—'}ms
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Channel picker + actions */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="glass lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Voice channel</CardTitle>
            <CardDescription>
              Pick the channel where the bot should park 24/7.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select
              value={selectedChannel}
              onValueChange={setSelectedChannel}
              disabled={busy}
            >
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Select a voice channel…" />
              </SelectTrigger>
              <SelectContent>
                {DEMO_VOICE_CHANNELS.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.type === 'stage' ? '🎙️' : '🔊'} {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={handleJoin}
                disabled={busy || !selectedChannel}
                className="gap-2"
              >
                <Volume2 className="h-4 w-4" />
                {isConnected ? 'Switch channel' : 'Join & enable 24/7'}
              </Button>
              <Button
                variant="outline"
                onClick={handleLeave}
                disabled={busy || !isConnected}
                className="gap-2"
              >
                <LogOut className="h-4 w-4" />
                Leave
              </Button>
              <Button
                variant="destructive"
                onClick={handleForceLeave}
                disabled={busy || !isConnected}
                className="gap-2"
              >
                <AlertTriangle className="h-4 w-4" />
                Force leave & reset
              </Button>
            </div>

            <div className="rounded-lg border border-warning/30 bg-warning/5 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">
                    Force leave
                  </span>{' '}
                  wipes all connection state — use it when the bot is stuck in a
                  ghost connection. The bot's heartbeat auto-rejoins on its own
                  if the connection is just stalled.
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-base">In voice now</CardTitle>
            <CardDescription>Live members in this channel</CardDescription>
          </CardHeader>
          <CardContent>
            {activeMembers.length === 0 ? (
              <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                No one is in the channel right now.
              </div>
            ) : (
              <div className="space-y-2">
                {activeMembers.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center gap-3 rounded-lg border border-border/60 bg-background-elevated/40 p-2"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={m.avatar_url || undefined} />
                      <AvatarFallback>
                        {m.username?.[0]?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-foreground">
                        {m.username || 'Unknown'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <Clock className="mr-1 inline h-3 w-3" />
                        {formatMs(
                          Date.now() - new Date(m.joined_at).getTime()
                        )}{' '}
                        in VC
                      </div>
                    </div>
                    <Mic className="h-3.5 w-3.5 text-success" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Connection health */}
      <Card className="glass">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Connection health</CardTitle>
              <CardDescription>
                Bot process and gateway metrics
              </CardDescription>
            </div>
            <Badge
              variant="outline"
              className="gap-1.5 border-success/30 bg-success/10 text-success"
            >
              <Activity className="h-3 w-3" />
              Heartbeat running
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
                <Server className="h-3.5 w-3.5" /> Active VCs
              </div>
              <div className="mt-1 text-lg font-semibold text-foreground">
                {status?.active_connections ?? 0}
              </div>
            </div>
            <div className="rounded-lg border border-border/60 bg-background-elevated/40 p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Zap className="h-3.5 w-3.5" /> Gateway ping
              </div>
              <div className="mt-1 text-lg font-semibold text-foreground">
                {status?.ping_ms ?? '—'}ms
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
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <RefreshCw className="h-3 w-3" />
            Heartbeat checks every 2 minutes · auto-rejoin on ghost detection
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
