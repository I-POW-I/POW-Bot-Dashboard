'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Activity,
  FileText,
  MessageSquare,
  Shield,
  Users,
  Volume2,
} from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { fetchGuildConfig, insertAuditLog } from '@/lib/data';
import type { GuildConfig, LogChannelType } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

const LOG_TYPES: {
  key: LogChannelType;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}[] = [
  {
    key: 'voice',
    label: 'Voice Activity',
    description: 'Join, leave, move, mute, deafen, stream, and video events.',
    icon: Volume2,
    color: 'text-primary bg-primary/10',
  },
  {
    key: 'messages',
    label: 'Message Logs',
    description: 'Deleted and edited messages (with original content).',
    icon: MessageSquare,
    color: 'text-chart-4 bg-chart-4/10',
  },
  {
    key: 'members',
    label: 'Member Join / Leave',
    description: 'New member arrivals and departures.',
    icon: Users,
    color: 'text-chart-2 bg-chart-2/10',
  },
  {
    key: 'modlog',
    label: 'Moderation Actions',
    description: 'Kick, ban, timeout, and warning audit events.',
    icon: Shield,
    color: 'text-warning bg-warning/10',
  },
];

const DEMO_TEXT_CHANNELS = [
  { id: '9182736451029384', name: 'vc-logs' },
  { id: '9182736451029385', name: 'message-logs' },
  { id: '9182736451029386', name: 'member-logs' },
  { id: '9182736451029387', name: 'mod-log' },
  { id: '9182736451029388', name: 'general' },
  { id: '9182736451029389', name: 'bot-commands' },
];

export default function LoggingPage() {
  const params = useParams<{ guildId: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const [config, setConfig] = useState<GuildConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user || !params?.guildId) return;
    (async () => {
      const c = await fetchGuildConfig(params.guildId);
      setConfig(c);
      setLoading(false);
    })();
  }, [user, params?.guildId]);

  const updateLogChannel = async (type: LogChannelType, channelId: string | null) => {
    if (!config || !params?.guildId) return;
    setBusy(true);
    const newLogChannels = { ...config.log_channels, [type]: channelId };
    const { error } = await supabase
      .from('guild_configs')
      .update({
        log_channels: newLogChannels,
        updated_at: new Date().toISOString(),
      })
      .eq('guild_id', params.guildId);
    if (error) {
      toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
      setBusy(false);
      return;
    }
    setConfig({ ...config, log_channels: newLogChannels });
    const channelName = DEMO_TEXT_CHANNELS.find((c) => c.id === channelId)?.name;
    await insertAuditLog({
      guild_id: params.guildId,
      actor_discord_id: user!.discordId,
      actor_username: user!.username,
      action: channelId
        ? `Set ${type} log channel to #${channelName}`
        : `Cleared ${type} log channel`,
      category: 'logging',
      details: { type, channelId },
    });
    toast({
      title: channelId ? 'Log channel updated' : 'Log channel cleared',
      description: channelId
        ? `#${channelName} will receive ${type} logs.`
        : `${type} logs are now disabled.`,
    });
    setBusy(false);
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Activity className="h-6 w-6 animate-pulse text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Log Channels
        </h2>
        <p className="text-sm text-muted-foreground">
          Choose where the bot posts each type of event log. Mirrors the{' '}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">/setlogs</code>{' '}
          command.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {LOG_TYPES.map((t) => {
          const current = config?.log_channels?.[t.key] || '';
          const currentChannel = DEMO_TEXT_CHANNELS.find((c) => c.id === current);
          return (
            <Card key={t.key} className="glass">
              <CardHeader>
                <div className="flex items-start gap-4">
                  <div
                    className={cn(
                      'flex h-11 w-11 items-center justify-center rounded-xl',
                      t.color
                    )}
                  >
                    <t.icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-base">{t.label}</CardTitle>
                    <CardDescription className="mt-1">
                      {t.description}
                    </CardDescription>
                  </div>
                  {current ? (
                    <Badge
                      variant="outline"
                      className="border-success/30 bg-success/10 text-success"
                    >
                      Active
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">
                      Off
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <Select
                  value={current || '__none'}
                  onValueChange={(v) =>
                    updateLogChannel(t.key, v === '__none' ? null : v)
                  }
                  disabled={busy}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a channel…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">— Disabled —</SelectItem>
                    {DEMO_TEXT_CHANNELS.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        # {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {current && (
                  <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background-elevated/40 px-3 py-2 text-xs">
                    <span className="text-muted-foreground">Posting to</span>
                    <span className="font-medium text-foreground">
                      # {currentChannel?.name || current}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-base">How voice logs work</CardTitle>
          <CardDescription>
            The bot posts a coloured embed when someone:
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {[
              { color: 'bg-success', label: 'Joins a voice channel' },
              { color: 'bg-destructive', label: 'Leaves a voice channel' },
              { color: 'bg-chart-4', label: 'Moves between channels' },
              { color: 'bg-warning', label: 'Server mutes / deafens' },
              { color: 'bg-chart-3', label: 'Starts / stops streaming' },
              { color: 'bg-primary', label: 'Turns camera on / off' },
            ].map((e) => (
              <div
                key={e.label}
                className="flex items-center gap-3 rounded-lg border border-border/60 bg-background-elevated/40 p-3"
              >
                <span className={cn('h-2.5 w-2.5 rounded-full', e.color)} />
                <span className="text-foreground">{e.label}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Self-mute and self-deafen are intentionally not logged.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
