'use client';

import { useEffect, useState } from 'react';
import {
  Activity,
  Cpu,
  Gamepad2,
  Headphones,
  Mic,
  Monitor,
  Plus,
  Radio,
  RefreshCw,
  Server,
  Volume2,
  X,
  Zap,
} from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { fetchBotStatus, formatUptime, insertAuditLog, relativeTime } from '@/lib/data';
import type { BotStatus, DashboardPresence } from '@/types';
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

const MAX_PRESENCES = 3;
const EMPTY_PRESENCE: DashboardPresence = { type: 'Custom', text: '' };

export default function OwnerControlsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [presences, setPresences] = useState<DashboardPresence[]>([{ ...EMPTY_PRESENCE }]);
  const [presenceMode, setPresenceMode] = useState<'rotate' | 'fixed'>('rotate');
  const [restarting, setRestarting] = useState(false);
  const [savingPresence, setSavingPresence] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const s = await fetchBotStatus();
      if (cancelled) return;
      setStatus(s);
      if (s?.presence_list?.length) {
        setPresences(s.presence_list);
      } else if (s?.presence_activity) {
        // Fall back to the old single-presence columns if no list has been set yet.
        setPresences([{ type: (s.presence_type as DashboardPresence['type']) || 'Custom', text: s.presence_activity }]);
      }
      if (s?.presence_mode) setPresenceMode(s.presence_mode);
    };

    load();
    // The "Streaming" badge below claims this data is live — previously it
    // was a single one-time fetch on mount, so a transient fetch failure
    // (or just viewing this page before the bot's first heartbeat landed)
    // displayed stale/empty data indefinitely with no way to recover short
    // of a manual page refresh. Polling means it self-heals within 15s.
    const interval = setInterval(load, 15_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const restart = async () => {
    setRestarting(true);
    const { error } = await supabase.from('bot_commands').insert({
      guild_id: 'global',
      command: 'restart',
      payload: {},
      status: 'pending',
    });
    if (error) {
      toast({ title: 'Restart failed to queue', description: error.message, variant: 'destructive' });
      setRestarting(false);
      return;
    }
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
      title: 'Restart queued',
      description: 'The bot will pick this up within 15 seconds and restart.',
    });
    setTimeout(() => setRestarting(false), 15000);
  };

  const updatePresenceSlot = (index: number, patch: Partial<DashboardPresence>) => {
    setPresences((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  };

  const addPresenceSlot = () => {
    if (presences.length >= MAX_PRESENCES) return;
    setPresences((prev) => [...prev, { ...EMPTY_PRESENCE }]);
  };

  const removePresenceSlot = (index: number) => {
    setPresences((prev) => prev.filter((_, i) => i !== index));
  };

  const updatePresence = async () => {
    const valid = presences.filter((p) => p.text.trim().length > 0);
    if (!valid.length) return;
    setSavingPresence(true);

    // Enqueue the real command the bot polls for and applies live.
    const { error: cmdError } = await supabase.from('bot_commands').insert({
      guild_id: 'global',
      command: 'presence',
      payload: { mode: presenceMode, presences: valid },
      status: 'pending',
    });

    // Also mirror it onto bot_status straight away so the dashboard reflects
    // the change immediately rather than waiting on the next bot heartbeat.
    const { error: statusError } = await supabase
      .from('bot_status')
      .update({
        presence_mode: presenceMode,
        presence_list: valid,
        presence_activity: valid[0].text,
        presence_type: valid[0].type,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1);

    setSavingPresence(false);

    const error = cmdError || statusError;
    if (error) {
      toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
      return;
    }
    if (user) {
      await insertAuditLog({
        guild_id: 'global',
        actor_discord_id: user.discordId,
        actor_username: user.username,
        action: `Changed presence (${presenceMode}): ${valid.map((p) => `${p.type}: ${p.text}`).join(', ')}`,
        category: 'presence',
        details: { mode: presenceMode, presences: valid },
      });
    }
    toast({ title: 'Presence updated', description: 'The bot will apply this within 15 seconds.' });
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
                    {status?.memory_mb?.toFixed(1) ?? '—'} MB
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
              This queues a restart command the bot picks up within 15
              seconds. It will re-join all configured 24/7 voice channels on
              boot.
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
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Mode
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setPresenceMode('rotate')}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-xs font-medium transition-all',
                    presenceMode === 'rotate'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border/60 text-muted-foreground hover:text-foreground'
                  )}
                >
                  Add to rotation
                </button>
                <button
                  onClick={() => setPresenceMode('fixed')}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-xs font-medium transition-all',
                    presenceMode === 'fixed'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border/60 text-muted-foreground hover:text-foreground'
                  )}
                >
                  Only these ({presences.length})
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                {presenceMode === 'rotate'
                  ? 'These will be blended into the normal 20s rotation alongside active VCs and member count.'
                  : 'The bot will cycle only through the statuses below — no active VCs or member count.'}
              </p>
            </div>

            <div className="space-y-3">
              {presences.map((p, i) => (
                <div key={i} className="space-y-2 rounded-lg border border-border/60 p-3">
                  <div className="flex items-center justify-between">
                    <div className="grid grid-cols-4 gap-1.5">
                      {PRESENCE_TYPES.map((t) => (
                        <button
                          key={t.value}
                          onClick={() => updatePresenceSlot(i, { type: t.value as DashboardPresence['type'] })}
                          title={t.label}
                          className={cn(
                            'flex items-center justify-center rounded-md border p-1.5 transition-all',
                            p.type === t.value
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border/60 text-muted-foreground hover:text-foreground'
                          )}
                        >
                          <t.icon className="h-3.5 w-3.5" />
                        </button>
                      ))}
                    </div>
                    {presences.length > 1 && (
                      <button
                        onClick={() => removePresenceSlot(i)}
                        className="ml-2 rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        title="Remove this status"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <Input
                    value={p.text}
                    onChange={(e) => updatePresenceSlot(i, { text: e.target.value })}
                    placeholder="🔊 POW Lounge · 14h 22m"
                  />
                </div>
              ))}
            </div>

            {presences.length < MAX_PRESENCES && (
              <Button variant="outline" onClick={addPresenceSlot} className="w-full gap-2">
                <Plus className="h-4 w-4" />
                Add another status ({presences.length}/{MAX_PRESENCES})
              </Button>
            )}

            <Button
              onClick={updatePresence}
              disabled={savingPresence || !presences.some((p) => p.text.trim())}
              className="w-full"
            >
              {savingPresence ? 'Updating…' : 'Update presence'}
            </Button>
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
                {status?.memory_mb?.toFixed(1) ?? '—'} MB
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
