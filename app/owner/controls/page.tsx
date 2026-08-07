'use client';

import { useEffect, useState } from 'react';
import {
  Activity,
  Cpu,
  Gamepad2,
  Headphones,
  Mic,
  Monitor,
  Radio,
  RefreshCw,
  Server,
  Volume2,
  Zap,
} from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { fetchBotStatus, formatUptime, insertAuditLog, relativeTime } from '@/lib/data';
import type { BotStatus } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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

const PRESENCE_TYPES = [
  { value: 'Playing', label: 'Playing', icon: Gamepad2 },
  { value: 'Watching', label: 'Watching', icon: Monitor },
  { value: 'Listening', label: 'Listening', icon: Headphones },
  { value: 'Custom', label: 'Custom', icon: Mic },
];

export default function OwnerControlsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [presenceType, setPresenceType] = useState('Custom');
  const [presenceText, setPresenceText] = useState('');
  const [restarting, setRestarting] = useState(false);

  useEffect(() => {
    (async () => {
      const s = await fetchBotStatus();
      setStatus(s);
      if (s?.presence_activity) setPresenceText(s.presence_activity);
      if (s?.presence_type) setPresenceType(s.presence_type);
    })();
  }, []);

  const restart = async () => {
    setRestarting(true);
    if (user) {
      await insertAuditLog({
        guild_id: 'global',
        actor_discord_id: user.discordId,
        actor_username: user.username,
        action: 'Triggered bot restart',
        category: 'system',
        details: {},
      });
    }
    toast({
      title: 'Restart triggered',
      description: 'The bot process will restart in a few seconds.',
    });
    setTimeout(() => setRestarting(false), 2000);
  };

  const updatePresence = async () => {
    if (!presenceText) return;
    const { error } = await supabase
      .from('bot_status')
      .update({
        presence_activity: presenceText,
        presence_type: presenceType,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1);
    if (error) {
      toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
      return;
    }
    if (user) {
      await insertAuditLog({
        guild_id: 'global',
        actor_discord_id: user.discordId,
        actor_username: user.username,
        action: `Changed presence to ${presenceType}: ${presenceText}`,
        category: 'presence',
        details: { type: presenceType, text: presenceText },
      });
    }
    toast({ title: 'Presence updated' });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Bot Controls
        </h1>
        <p className="text-sm text-muted-foreground">
          Restart the bot, change its presence, and monitor live connections.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Restart */}
        <Card className="glass">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/10 text-warning">
                <RefreshCw className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">Process control</CardTitle>
                <CardDescription>Restart the bot process</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-border/60 bg-background-elevated/40 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Current state</span>
                <Badge
                  variant="outline"
                  className={cn(
                    status?.online
                      ? 'border-success/30 bg-success/10 text-success'
                      : 'border-destructive/30 bg-destructive/10 text-destructive'
                  )}
                >
                  {status?.online ? 'Online' : 'Offline'}
                </Badge>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Uptime</div>
                  <div className="font-semibold text-foreground">
                    {formatUptime(status?.process_uptime_ms)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Memory</div>
                  <div className="font-semibold text-foreground">
                    {status?.memory_mb.toFixed(1) ?? '—'} MB
                  </div>
                </div>
              </div>
            </div>
            <Button
              onClick={restart}
              disabled={restarting}
              variant="outline"
              className="w-full gap-2 border-warning/40 text-warning hover:bg-warning/10"
            >
              <RefreshCw className={cn('h-4 w-4', restarting && 'animate-spin')} />
              {restarting ? 'Restarting…' : 'Restart bot'}
            </Button>
            <p className="text-xs text-muted-foreground">
              This calls the bot's process manager endpoint. The bot will
              re-join all configured 24/7 voice channels on boot.
            </p>
          </CardContent>
        </Card>

        {/* Presence */}
        <Card className="glass">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Activity className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">Presence</CardTitle>
                <CardDescription>Bot activity / status text</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {PRESENCE_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setPresenceType(t.value)}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-lg border px-2 py-3 text-xs font-medium transition-all',
                    presenceType === t.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border/60 text-muted-foreground hover:text-foreground'
                  )}
                >
                  <t.icon className="h-4 w-4" />
                  {t.label}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Activity text
              </Label>
              <Input
                value={presenceText}
                onChange={(e) => setPresenceText(e.target.value)}
                placeholder="🔊 POW Lounge · 14h 22m"
              />
            </div>
            <Button onClick={updatePresence} disabled={!presenceText} className="w-full">
              Update presence
            </Button>
            <p className="text-xs text-muted-foreground">
              The bot's statusUpdater rotates between active VCs and total
              members every 20 seconds. Setting a custom presence overrides the
              rotation until the next restart.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Live metrics */}
      <Card className="glass">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Live metrics</CardTitle>
              <CardDescription>Updated {relativeTime(status?.updated_at)}</CardDescription>
            </div>
            <Badge variant="outline" className="gap-1.5 border-success/30 bg-success/10 text-success">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              Streaming
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-border/60 bg-background-elevated/40 p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Server className="h-3.5 w-3.5" /> Servers
              </div>
              <div className="mt-1 text-lg font-semibold text-foreground">
                {status?.total_guilds ?? '—'}
              </div>
            </div>
            <div className="rounded-lg border border-border/60 bg-background-elevated/40 p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Volume2 className="h-3.5 w-3.5" /> Active VCs
              </div>
              <div className="mt-1 text-lg font-semibold text-foreground">
                {status?.active_connections ?? '—'}
              </div>
            </div>
            <div className="rounded-lg border border-border/60 bg-background-elevated/40 p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Zap className="h-3.5 w-3.5" /> Ping
              </div>
              <div className="mt-1 text-lg font-semibold text-foreground">
                {status?.ping_ms ?? '—'}ms
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
