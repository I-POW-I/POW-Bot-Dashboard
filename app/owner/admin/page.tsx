'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { format } from 'date-fns';
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock,
  Cpu,
  Filter,
  Globe,
  Key,
  Lock,
  Mail,
  MessageSquare,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Server,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Users,
  Volume2,
  X,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/providers/auth-provider';
import { supabase } from '@/lib/supabase';
import {
  fetchAuditLog,
  fetchBotStatus,
  fetchGuildConfig,
  insertAuditLog,
  relativeTime,
  formatUptime,
} from '@/lib/data';
import type {
  AuditLogEntry,
  BotStatus,
  GuildConfig,
} from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface BotConfig {
  id: number;
  maintenance_mode: boolean;
  global_prefix: string;
  owner_whitelist: string[];
  updated_at: string;
}

interface WelcomeConfig {
  id?: string;
  guild_id: string;
  join_enabled: boolean;
  leave_enabled: boolean;
  welcome_channel_id: string | null;
  leave_channel_id: string | null;
  join_message: string;
  leave_message: string;
  show_join_date: boolean;
}

// ── Schemas ───────────────────────────────────────────────────────────────────

const botSettingsSchema = z.object({
  global_prefix: z.string().min(1, 'Required').max(5, 'Max 5 chars'),
  maintenance_mode: z.boolean(),
});
type BotSettingsForm = z.infer<typeof botSettingsSchema>;

const welcomeSchema = z.object({
  join_message: z.string().min(1, 'Required'),
  leave_message: z.string().min(1, 'Required'),
});
type WelcomeForm = z.infer<typeof welcomeSchema>;

// ── Constants ─────────────────────────────────────────────────────────────────

const DEMO_TEXT_CHANNELS = [
  { id: '9182736451029390', name: 'welcome' },
  { id: '9182736451029391', name: 'goodbye' },
  { id: '9182736451029388', name: 'general' },
];

const DEMO_ROLES = [
  { id: '9182736451029392', name: 'Admin' },
  { id: '9182736451029394', name: 'Moderator' },
  { id: '9182736451029396', name: 'Member' },
];

const AUDIT_CATEGORIES = [
  { value: 'all', label: 'All events' },
  { value: 'voice', label: 'Voice' },
  { value: 'system', label: 'System' },
  { value: 'welcome', label: 'Welcome' },
  { value: 'announcement', label: 'Announcements' },
  { value: 'blacklist', label: 'Blacklist' },
  { value: 'presence', label: 'Presence' },
];

const VARIABLE_PLACEHOLDERS = [
  { key: '{nickname}', desc: "Server nickname (falls back to display name)" },
  { key: '{username}', desc: 'Discord @username' },
  { key: '{server}', desc: 'Server name' },
  { key: '{count}', desc: 'Member count' },
];

// ── Placeholder resolvers ─────────────────────────────────────────────────────

function resolvePlaceholders(template: string, context: {
  nickname?: string;
  username?: string;
  server?: string;
  count?: number;
}): string {
  return template
    .replace(/{nickname}/g, context.nickname ?? 'PowUser')
    .replace(/{username}/g, context.username ?? 'pow_user')
    .replace(/{server}/g, context.server ?? 'POW Lounge')
    .replace(/{count}/g, String(context.count ?? 1843));
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminPanelPage() {
  const { user } = useAuth();

  // Shared data
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [guilds, setGuilds] = useState<GuildConfig[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [botConfig, setBotConfig] = useState<BotConfig | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  const loadAll = useCallback(async () => {
    if (!user) return;
    const [s, cfg, ...guildConfigs] = await Promise.all([
      fetchBotStatus(),
      supabase.from('bot_config').select('*').eq('id', 1).maybeSingle(),
      ...user.guilds.map((g) => fetchGuildConfig(g.guildId)),
    ]);
    setBotStatus(s);
    if (cfg.data) setBotConfig(cfg.data as BotConfig);
    setGuilds(guildConfigs.filter(Boolean) as GuildConfig[]);
    // Fetch audit logs across all guilds
    const allLogs = await Promise.all(
      user.guilds.map((g) => fetchAuditLog(g.guildId, 50))
    );
    const merged = allLogs
      .flat()
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 100);
    setAuditLogs(merged);
    setDataLoading(false);
  }, [user]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  if (dataLoading) {
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
          Admin Panel
        </h1>
        <p className="text-sm text-muted-foreground">
          Full control over every aspect of the bot — owner access only.
        </p>
      </div>

      <Tabs defaultValue="dashboard">
        <TabsList className="flex-wrap gap-1 h-auto">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="welcome">Welcome Messages</TabsTrigger>
          <TabsTrigger value="servers">Server Management</TabsTrigger>
          <TabsTrigger value="settings">Bot Settings</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-6">
          <DashboardTab botStatus={botStatus} guilds={guilds} auditLogs={auditLogs} user={user} reload={loadAll} />
        </TabsContent>

        <TabsContent value="welcome" className="mt-6">
          <WelcomeTab guilds={guilds} user={user} />
        </TabsContent>

        <TabsContent value="servers" className="mt-6">
          <ServersTab guilds={guilds} user={user} reload={loadAll} />
        </TabsContent>

        <TabsContent value="settings" className="mt-6">
          <BotSettingsTab botConfig={botConfig} setBotConfig={setBotConfig} botStatus={botStatus} user={user} />
        </TabsContent>

        <TabsContent value="logs" className="mt-6">
          <LogsTab auditLogs={auditLogs} guilds={guilds} />
        </TabsContent>

        <TabsContent value="permissions" className="mt-6">
          <PermissionsTab guilds={guilds} user={user} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Dashboard Tab ─────────────────────────────────────────────────────────────

function DashboardTab({
  botStatus,
  guilds,
  auditLogs,
  user,
  reload,
}: {
  botStatus: BotStatus | null;
  guilds: GuildConfig[];
  auditLogs: AuditLogEntry[];
  user: any;
  reload: () => void;
}) {
  const activeGuilds = guilds.filter((g) => g.target_voice_channel_id).length;

  const quickAction = async (label: string) => {
    if (user) {
      await insertAuditLog({
        guild_id: 'global',
        actor_discord_id: user.discordId,
        actor_username: user.username,
        action: label,
        category: 'system',
        details: {},
      });
    }
    toast.success(label);
    reload();
  };

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Total servers', value: botStatus?.total_guilds ?? guilds.length, icon: Server, accent: 'text-primary bg-primary/10' },
          { label: 'Total members', value: (botStatus?.total_members ?? 0).toLocaleString(), icon: Users, accent: 'text-chart-4 bg-chart-4/10' },
          { label: '24/7 active VCs', value: activeGuilds, icon: Volume2, accent: 'text-success bg-success/10' },
          { label: 'Process uptime', value: formatUptime(botStatus?.process_uptime_ms), icon: Clock, accent: 'text-chart-3 bg-chart-3/10' },
        ].map((stat) => (
          <Card key={stat.label} className="glass relative overflow-hidden p-5">
            <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br from-primary/5 to-transparent blur-2xl" />
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{stat.label}</p>
                <p className="mt-2 text-2xl font-bold text-foreground">{stat.value}</p>
              </div>
              <div className={cn('flex h-11 w-11 items-center justify-center rounded-xl', stat.accent)}>
                <stat.icon className="h-5 w-5" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Quick actions + recent activity */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-base">Quick actions</CardTitle>
            <CardDescription>Common admin operations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { label: 'Sync slash commands globally', icon: Zap },
              { label: 'Clear all caches', icon: RefreshCw },
              { label: 'Broadcast heartbeat check', icon: Activity },
              { label: 'Export audit logs (CSV)', icon: Filter },
            ].map((action) => (
              <Button
                key={action.label}
                variant="outline"
                className="w-full justify-start gap-2 text-sm"
                onClick={() => quickAction(action.label)}
              >
                <action.icon className="h-3.5 w-3.5 text-muted-foreground" />
                {action.label}
              </Button>
            ))}
          </CardContent>
        </Card>

        <Card className="glass lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Recent activity</CardTitle>
                <CardDescription>Latest events across all servers</CardDescription>
              </div>
              <Badge variant="outline" className="text-xs">{auditLogs.length} events</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64">
              {auditLogs.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No activity yet.</p>
              ) : (
                <div className="space-y-2">
                  {auditLogs.slice(0, 15).map((log) => (
                    <div key={log.id} className="flex items-start gap-3 rounded-lg p-2 hover:bg-accent/5">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <Activity className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-foreground">{log.action}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {log.actor_username ?? 'System'} · {relativeTime(log.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Bot health */}
      <Card className="glass">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Process health</CardTitle>
              <CardDescription>Updated {relativeTime(botStatus?.updated_at)}</CardDescription>
            </div>
            <Badge
              variant="outline"
              className={botStatus?.online
                ? 'border-success/30 bg-success/10 text-success'
                : 'border-destructive/30 bg-destructive/10 text-destructive'}
            >
              {botStatus?.online ? 'Online' : 'Offline'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Gateway ping', value: `${botStatus?.ping_ms ?? '—'}ms`, icon: Zap },
              { label: 'Memory', value: `${botStatus?.memory_mb?.toFixed(1) ?? '—'} MB`, icon: Cpu },
              { label: 'Active connections', value: botStatus?.active_connections ?? '—', icon: Volume2 },
              { label: 'Presence', value: botStatus?.presence_activity || '—', icon: Activity },
            ].map((m) => (
              <div key={m.label} className="rounded-lg border border-border/60 bg-background-elevated/40 p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <m.icon className="h-3.5 w-3.5" /> {m.label}
                </div>
                <div className="mt-1 truncate text-sm font-semibold text-foreground">{m.value}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Welcome Messages Tab ──────────────────────────────────────────────────────

function WelcomeTab({ guilds, user }: { guilds: GuildConfig[]; user: any }) {
  const [selectedGuildId, setSelectedGuildId] = useState(guilds[0]?.guild_id ?? '');
  const [wcfg, setWcfg] = useState<WelcomeConfig>({
    guild_id: guilds[0]?.guild_id ?? '',
    join_enabled: true,
    leave_enabled: true,
    welcome_channel_id: null,
    leave_channel_id: null,
    join_message: 'Welcome to **{server}**, {nickname}! You are member #{count}.',
    leave_message: '{nickname} has left the server.',
    show_join_date: true,
  });
  const [busy, setBusy] = useState(false);
  const [previewEvent, setPreviewEvent] = useState<'join' | 'leave'>('join');

  const form = useForm<WelcomeForm>({
    resolver: zodResolver(welcomeSchema),
    defaultValues: { join_message: wcfg.join_message, leave_message: wcfg.leave_message },
  });

  const loadConfig = useCallback(async (guildId: string) => {
    const { data } = await supabase
      .from('welcome_config')
      .select('*')
      .eq('guild_id', guildId)
      .maybeSingle();
    if (data) {
      setWcfg(data as WelcomeConfig);
      form.reset({ join_message: data.join_message, leave_message: data.leave_message });
    } else {
      const defaults: WelcomeConfig = {
        guild_id: guildId,
        join_enabled: true,
        leave_enabled: true,
        welcome_channel_id: null,
        leave_channel_id: null,
        join_message: 'Welcome to **{server}**, {nickname}! You are member #{count}.',
        leave_message: '{nickname} has left the server.',
        show_join_date: true,
      };
      setWcfg(defaults);
      form.reset({ join_message: defaults.join_message, leave_message: defaults.leave_message });
    }
  }, [form]);

  useEffect(() => {
    if (selectedGuildId) loadConfig(selectedGuildId);
  }, [selectedGuildId, loadConfig]);

  const save = async (patch: Partial<WelcomeConfig>) => {
    setBusy(true);
    const merged = { ...wcfg, ...patch, guild_id: selectedGuildId, updated_at: new Date().toISOString() };
    const { error } = await supabase
      .from('welcome_config')
      .upsert(merged, { onConflict: 'guild_id' });
    if (error) {
      toast.error('Save failed', { description: error.message });
    } else {
      setWcfg(merged);
      toast.success('Welcome config saved');
      if (user) {
        await insertAuditLog({
          guild_id: selectedGuildId,
          actor_discord_id: user.discordId,
          actor_username: user.username,
          action: 'Updated welcome message config',
          category: 'welcome',
          details: patch as Record<string, unknown>,
        });
      }
    }
    setBusy(false);
  };

  const onSaveMessages = async (values: WelcomeForm) => {
    await save(values);
  };

  const previewMsg = previewEvent === 'join' ? form.watch('join_message') : form.watch('leave_message');
  const resolvedPreview = resolvePlaceholders(previewMsg, {
    nickname: 'The Donkey',
    username: 'thedonkey',
    server: guilds.find((g) => g.guild_id === selectedGuildId)?.guild_name || 'POW Lounge',
    count: 1843,
  });

  const selectedGuild = guilds.find((g) => g.guild_id === selectedGuildId);

  return (
    <div className="space-y-6">
      {/* Server picker */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-base">Configure server</CardTitle>
          <CardDescription>Select which server's welcome messages to edit.</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedGuildId} onValueChange={setSelectedGuildId}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select server…" />
            </SelectTrigger>
            <SelectContent>
              {guilds.map((g) => (
                <SelectItem key={g.guild_id} value={g.guild_id}>
                  {g.guild_name || g.guild_id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Toggles + channels */}
        <div className="space-y-4">
          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-base">Message toggles</CardTitle>
              <CardDescription>Enable or disable join and leave messages independently.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background-elevated/40 p-4">
                <div>
                  <Label className="text-sm font-medium text-foreground">Join messages</Label>
                  <p className="text-xs text-muted-foreground">Send a card when someone joins</p>
                </div>
                <Switch
                  checked={wcfg.join_enabled}
                  disabled={busy}
                  onCheckedChange={(v) => save({ join_enabled: v })}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background-elevated/40 p-4">
                <div>
                  <Label className="text-sm font-medium text-foreground">Leave messages</Label>
                  <p className="text-xs text-muted-foreground">Send a card when someone leaves</p>
                </div>
                <Switch
                  checked={wcfg.leave_enabled}
                  disabled={busy}
                  onCheckedChange={(v) => save({ leave_enabled: v })}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background-elevated/40 p-4">
                <div>
                  <Label className="text-sm font-medium text-foreground">Show join date on leave</Label>
                  <p className="text-xs text-muted-foreground">Display when they originally joined</p>
                </div>
                <Switch
                  checked={wcfg.show_join_date}
                  disabled={busy}
                  onCheckedChange={(v) => save({ show_join_date: v })}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-base">Channels</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Welcome channel</Label>
                <Select
                  value={wcfg.welcome_channel_id || '__none'}
                  disabled={busy}
                  onValueChange={(v) => save({ welcome_channel_id: v === '__none' ? null : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select channel…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">— Disabled —</SelectItem>
                    {DEMO_TEXT_CHANNELS.map((c) => (
                      <SelectItem key={c.id} value={c.id}># {c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Leave channel</Label>
                <Select
                  value={wcfg.leave_channel_id || '__none'}
                  disabled={busy}
                  onValueChange={(v) => save({ leave_channel_id: v === '__none' ? null : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Defaults to welcome channel…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">— Same as welcome channel —</SelectItem>
                    {DEMO_TEXT_CHANNELS.map((c) => (
                      <SelectItem key={c.id} value={c.id}># {c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Message editor + preview */}
        <div className="space-y-4">
          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-base">Message templates</CardTitle>
              <CardDescription>Use placeholders to personalise messages.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={form.handleSubmit(onSaveMessages)} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Join message</Label>
                  <Textarea
                    rows={3}
                    {...form.register('join_message')}
                    className="resize-none font-mono text-xs"
                  />
                  {form.formState.errors.join_message && (
                    <p className="text-xs text-destructive">{form.formState.errors.join_message.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Leave message</Label>
                  <Textarea
                    rows={3}
                    {...form.register('leave_message')}
                    className="resize-none font-mono text-xs"
                  />
                  {form.formState.errors.leave_message && (
                    <p className="text-xs text-destructive">{form.formState.errors.leave_message.message}</p>
                  )}
                </div>

                {/* Placeholder helpers */}
                <div className="flex flex-wrap gap-1.5">
                  {VARIABLE_PLACEHOLDERS.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      title={p.desc}
                      className="rounded border border-border/60 bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {p.key}
                    </button>
                  ))}
                </div>

                <Button type="submit" className="w-full gap-2" disabled={busy}>
                  <CheckCircle2 className="h-4 w-4" />
                  Save messages
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Live preview */}
          <Card className="glass">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Live preview</CardTitle>
                  <CardDescription>How the embed looks in Discord</CardDescription>
                </div>
                <div className="flex gap-1">
                  {(['join', 'leave'] as const).map((e) => (
                    <button
                      key={e}
                      onClick={() => setPreviewEvent(e)}
                      className={cn(
                        'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                        previewEvent === e
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {e === 'join' ? 'Join' : 'Leave'}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <WelcomeCardPreview
                event={previewEvent}
                message={resolvedPreview}
                guildName={selectedGuild?.guild_name || 'POW Lounge'}
                showJoinDate={wcfg.show_join_date}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ── Welcome Card Preview ──────────────────────────────────────────────────────

function WelcomeCardPreview({
  event,
  message,
  guildName,
  showJoinDate,
}: {
  event: 'join' | 'leave';
  message: string;
  guildName: string;
  showJoinDate: boolean;
}) {
  const nickname = 'The Donkey';
  const username = 'thedonkey';
  const joinDate = 'January 15, 2024';

  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-[#1e1f2e]">
      {/* Discord-style embed */}
      <div className={cn(
        'flex flex-col items-center px-8 py-8 text-center',
        event === 'join' ? 'border-l-4 border-l-success' : 'border-l-4 border-l-chart-4'
      )}>
        {/* Avatar */}
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-chart-4 to-primary text-2xl font-bold text-primary-foreground ring-4 ring-border/40">
          {nickname[0].toUpperCase()}
        </div>

        {/* Large name — server nickname */}
        <p className="text-2xl font-bold tracking-tight text-white" style={{ fontFamily: 'Courier New, monospace' }}>
          {nickname}
        </p>

        {/* Event label */}
        <p className="mt-1.5 text-sm font-medium text-[#a0a5b0]">
          {event === 'join' ? 'Joined' : 'Left'}
        </p>

        {/* @username */}
        <p className="mt-0.5 text-xs text-[#7289da]">@{username}</p>

        {/* Join date */}
        {showJoinDate && (
          <p className="mt-3 text-xs text-[#72767d]">
            Joined: {joinDate}
          </p>
        )}

        {/* Resolved message */}
        <div className="mt-4 rounded-md border border-white/10 bg-white/5 px-4 py-2 text-xs text-[#dcddde]">
          {message}
        </div>
      </div>
    </div>
  );
}

// ── Server Management Tab ─────────────────────────────────────────────────────

function ServersTab({
  guilds,
  user,
  reload,
}: {
  guilds: GuildConfig[];
  user: any;
  reload: () => void;
}) {
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'recent'>('recent');
  const [forceLeaveTarget, setForceLeaveTarget] = useState<GuildConfig | null>(null);
  const [blacklistTarget, setBlacklistTarget] = useState<GuildConfig | null>(null);

  const filtered = useMemo(() => {
    let list = guilds.filter((g) =>
      !query || (g.guild_name || '').toLowerCase().includes(query.toLowerCase())
    );
    if (sortBy === 'name') list = list.sort((a, b) => (a.guild_name || '').localeCompare(b.guild_name || ''));
    else list = list.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    return list;
  }, [guilds, query, sortBy]);

  const handleForceLeave = async () => {
    if (!forceLeaveTarget || !user) return;
    await insertAuditLog({
      guild_id: forceLeaveTarget.guild_id,
      actor_discord_id: user.discordId,
      actor_username: user.username,
      action: `Force-left server: ${forceLeaveTarget.guild_name}`,
      category: 'system',
      details: { guild_id: forceLeaveTarget.guild_id },
    });
    toast.success(`Bot force-left ${forceLeaveTarget.guild_name}`);
    setForceLeaveTarget(null);
    reload();
  };

  const handleBlacklist = async () => {
    if (!blacklistTarget || !user) return;
    await supabase.from('blacklist').upsert({
      target_type: 'guild',
      target_id: blacklistTarget.guild_id,
      reason: `Blacklisted by owner ${user.username}`,
    }, { onConflict: 'target_type,target_id' });
    await insertAuditLog({
      guild_id: blacklistTarget.guild_id,
      actor_discord_id: user.discordId,
      actor_username: user.username,
      action: `Blacklisted server: ${blacklistTarget.guild_name}`,
      category: 'blacklist',
      details: { guild_id: blacklistTarget.guild_id },
    });
    toast.success(`${blacklistTarget.guild_name} blacklisted`);
    setBlacklistTarget(null);
    reload();
  };

  return (
    <>
      <Card className="glass">
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">All servers</CardTitle>
              <CardDescription>{guilds.length} server(s) the bot is in</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="h-9 w-48 pl-9"
                />
              </div>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as 'name' | 'recent')}>
                <SelectTrigger className="h-9 w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Most recent</SelectItem>
                  <SelectItem value="name">Name A–Z</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {filtered.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No servers match the search.</p>
            ) : filtered.map((g) => (
              <div
                key={g.guild_id}
                className="group flex items-center gap-4 rounded-lg border border-border/60 bg-background-elevated/40 p-3 transition-colors hover:border-border"
              >
                <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-chart-4 to-primary text-sm font-semibold text-primary-foreground shrink-0">
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
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-foreground">
                      {g.guild_name || 'Unnamed server'}
                    </span>
                    {g.target_voice_channel_id && (
                      <Badge variant="outline" className="shrink-0 border-success/30 bg-success/10 text-success text-[10px]">
                        24/7
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    ID: {g.guild_id} · Joined {relativeTime(g.joined_at)} · Reconnects: {g.reconnect_count}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Server actions</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => window.open(`/dashboard/${g.guild_id}`, '_self')}>
                      <Settings className="mr-2 h-3.5 w-3.5" />
                      Open dashboard
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-warning"
                      onClick={() => setForceLeaveTarget(g)}
                    >
                      <RefreshCw className="mr-2 h-3.5 w-3.5" />
                      Force leave
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => setBlacklistTarget(g)}
                    >
                      <ShieldAlert className="mr-2 h-3.5 w-3.5" />
                      Blacklist server
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!forceLeaveTarget} onOpenChange={(o) => !o && setForceLeaveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Force leave {forceLeaveTarget?.guild_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              The bot will immediately leave this server. You can re-invite it at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-warning text-warning-foreground hover:bg-warning/90" onClick={handleForceLeave}>
              Force leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!blacklistTarget} onOpenChange={(o) => !o && setBlacklistTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Blacklist {blacklistTarget?.guild_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              The bot will leave and refuse to rejoin this server. This can be reversed from the Blacklist table.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleBlacklist}>
              Blacklist
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ── Bot Settings Tab ──────────────────────────────────────────────────────────

function BotSettingsTab({
  botConfig,
  setBotConfig,
  botStatus,
  user,
}: {
  botConfig: BotConfig | null;
  setBotConfig: (c: BotConfig) => void;
  botStatus: BotStatus | null;
  user: any;
}) {
  const [newWhitelistId, setNewWhitelistId] = useState('');
  const [busy, setBusy] = useState(false);

  const form = useForm<BotSettingsForm>({
    resolver: zodResolver(botSettingsSchema),
    values: {
      global_prefix: botConfig?.global_prefix ?? '/',
      maintenance_mode: botConfig?.maintenance_mode ?? false,
    },
  });

  const saveSettings = async (values: BotSettingsForm) => {
    setBusy(true);
    const updated = {
      ...botConfig,
      ...values,
      id: 1,
      owner_whitelist: botConfig?.owner_whitelist ?? [],
      updated_at: new Date().toISOString(),
    } as BotConfig;
    const { error } = await supabase
      .from('bot_config')
      .upsert(updated, { onConflict: 'id' });
    if (error) {
      toast.error('Save failed', { description: error.message });
    } else {
      setBotConfig(updated);
      toast.success('Bot settings saved');
      if (user) {
        await insertAuditLog({
          guild_id: 'global',
          actor_discord_id: user.discordId,
          actor_username: user.username,
          action: `Updated bot settings: prefix=${values.global_prefix}, maintenance=${values.maintenance_mode}`,
          category: 'system',
          details: values as Record<string, unknown>,
        });
      }
    }
    setBusy(false);
  };

  const addToWhitelist = async () => {
    if (!newWhitelistId.trim()) return;
    const current = botConfig?.owner_whitelist ?? [];
    if (current.includes(newWhitelistId.trim())) {
      toast.error('Already in whitelist');
      return;
    }
    const updated = { ...botConfig, id: 1, owner_whitelist: [...current, newWhitelistId.trim()], updated_at: new Date().toISOString() } as BotConfig;
    const { error } = await supabase.from('bot_config').upsert(updated, { onConflict: 'id' });
    if (!error) {
      setBotConfig(updated);
      setNewWhitelistId('');
      toast.success('Added to whitelist');
    }
  };

  const removeFromWhitelist = async (id: string) => {
    const updated = {
      ...botConfig,
      id: 1,
      owner_whitelist: (botConfig?.owner_whitelist ?? []).filter((x) => x !== id),
      updated_at: new Date().toISOString(),
    } as BotConfig;
    const { error } = await supabase.from('bot_config').upsert(updated, { onConflict: 'id' });
    if (!error) {
      setBotConfig(updated);
      toast.success('Removed from whitelist');
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={form.handleSubmit(saveSettings)}>
        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-base">Global bot settings</CardTitle>
            <CardDescription>Settings that apply across every server.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="global_prefix">Command prefix</Label>
              <Input id="global_prefix" {...form.register('global_prefix')} className="w-24" placeholder="/" />
              {form.formState.errors.global_prefix && (
                <p className="text-xs text-destructive">{form.formState.errors.global_prefix.message}</p>
              )}
              <p className="text-xs text-muted-foreground">Slash commands use <code className="rounded bg-muted px-1">/</code> regardless of this setting.</p>
            </div>

            <Separator />

            <div className="flex items-center justify-between rounded-lg border border-warning/30 bg-warning/5 p-4">
              <div>
                <Label className="text-sm font-medium text-foreground">Maintenance mode</Label>
                <p className="text-xs text-muted-foreground">
                  When enabled, the bot stops responding to all commands except owner-only ones.
                </p>
              </div>
              <Switch
                checked={form.watch('maintenance_mode')}
                onCheckedChange={(v) => form.setValue('maintenance_mode', v)}
              />
            </div>

            {form.watch('maintenance_mode') && (
              <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3">
                <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
                <p className="text-xs text-warning">
                  Maintenance mode is active. Regular users cannot use any bot commands.
                </p>
              </div>
            )}

            <Button type="submit" className="gap-2" disabled={busy}>
              <CheckCircle2 className="h-4 w-4" />
              Save settings
            </Button>
          </CardContent>
        </Card>
      </form>

      {/* Owner whitelist */}
      <Card className="glass">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-chart-4" />
            <div>
              <CardTitle className="text-base">Owner whitelist</CardTitle>
              <CardDescription>
                Discord user IDs that have owner-level access. Add your own ID here to ensure access.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Discord user ID (e.g. 1234567890)"
              value={newWhitelistId}
              onChange={(e) => setNewWhitelistId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addToWhitelist())}
              className="font-mono text-sm"
            />
            <Button variant="outline" onClick={addToWhitelist} className="gap-1.5 shrink-0">
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>

          <div className="space-y-2">
            {(botConfig?.owner_whitelist ?? []).length === 0 ? (
              <p className="rounded-lg border border-border/60 bg-background-elevated/40 p-4 text-sm text-muted-foreground text-center">
                No users on the whitelist. Add a Discord user ID above.
              </p>
            ) : (
              (botConfig?.owner_whitelist ?? []).map((uid) => (
                <div
                  key={uid}
                  className="flex items-center justify-between rounded-lg border border-border/60 bg-background-elevated/40 px-4 py-3"
                >
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-chart-4" />
                    <code className="text-sm text-foreground">{uid}</code>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => removeFromWhitelist(uid)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Current bot status overview */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-base">Current status</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {[
            { label: 'Online', value: botStatus?.online ? 'Yes' : 'No', icon: Activity },
            { label: 'Ping', value: `${botStatus?.ping_ms ?? '—'}ms`, icon: Zap },
            { label: 'Presence type', value: botStatus?.presence_type || '—', icon: Globe },
            { label: 'Presence text', value: botStatus?.presence_activity || '—', icon: MessageSquare },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-3 rounded-lg border border-border/60 bg-background-elevated/40 p-3">
              <s.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-sm font-medium text-foreground">{s.value}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Logs Tab ──────────────────────────────────────────────────────────────────

function LogsTab({
  auditLogs,
  guilds,
}: {
  auditLogs: AuditLogEntry[];
  guilds: GuildConfig[];
}) {
  const [guildFilter, setGuildFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  const CATEGORY_META: Record<string, { icon: typeof Activity; color: string }> = {
    voice: { icon: Volume2, color: 'text-primary' },
    system: { icon: Settings, color: 'text-chart-4' },
    welcome: { icon: Users, color: 'text-success' },
    announcement: { icon: Globe, color: 'text-chart-3' },
    blacklist: { icon: ShieldAlert, color: 'text-destructive' },
    presence: { icon: Activity, color: 'text-warning' },
    logging: { icon: Filter, color: 'text-muted-foreground' },
    streamers: { icon: Activity, color: 'text-chart-5' },
    verification: { icon: ShieldCheck, color: 'text-chart-4' },
  };

  const filtered = useMemo(() => {
    return auditLogs.filter((log) => {
      if (guildFilter !== 'all' && log.guild_id !== guildFilter) return false;
      if (categoryFilter !== 'all' && log.category !== categoryFilter) return false;
      if (search && !log.action.toLowerCase().includes(search.toLowerCase()) && !(log.actor_username || '').toLowerCase().includes(search.toLowerCase())) return false;
      if (dateFrom && new Date(log.created_at) < new Date(dateFrom)) return false;
      if (dateTo && new Date(log.created_at) > new Date(dateTo + 'T23:59:59')) return false;
      return true;
    });
  }, [auditLogs, guildFilter, categoryFilter, search, dateFrom, dateTo]);

  return (
    <Card className="glass">
      <CardHeader>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Audit logs</CardTitle>
              <CardDescription>{filtered.length} of {auditLogs.length} events</CardDescription>
            </div>
          </div>
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search actions…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 w-44 pl-9 text-sm"
              />
            </div>
            <Select value={guildFilter} onValueChange={setGuildFilter}>
              <SelectTrigger className="h-9 w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All servers</SelectItem>
                {guilds.map((g) => (
                  <SelectItem key={g.guild_id} value={g.guild_id}>{g.guild_name || g.guild_id}</SelectItem>
                ))}
                <SelectItem value="global">Global</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-9 w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AUDIT_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-9 w-36 text-xs"
              placeholder="From"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-9 w-36 text-xs"
              placeholder="To"
            />
            {(search || guildFilter !== 'all' || categoryFilter !== 'all' || dateFrom || dateTo) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 gap-1 text-muted-foreground"
                onClick={() => { setSearch(''); setGuildFilter('all'); setCategoryFilter('all'); setDateFrom(''); setDateTo(''); }}
              >
                <X className="h-3.5 w-3.5" />
                Clear
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[480px]">
          {filtered.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
              <Filter className="h-6 w-6" />
              <span className="text-sm">No log entries match the filters.</span>
            </div>
          ) : (
            <div className="space-y-1">
              {filtered.map((log) => {
                const meta = CATEGORY_META[log.category] ?? { icon: Activity, color: 'text-muted-foreground' };
                const Icon = meta.icon;
                const guild = guilds.find((g) => g.guild_id === log.guild_id);
                return (
                  <div key={log.id} className="flex items-start gap-3 rounded-lg p-3 hover:bg-accent/5 transition-colors">
                    <div className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted', meta.color)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{log.action}</span>
                        <Badge variant="outline" className="text-[10px] capitalize">{log.category}</Badge>
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {log.actor_username && <span>{log.actor_username}</span>}
                        {guild && <span>· {guild.guild_name}</span>}
                        <span>· {relativeTime(log.created_at)}</span>
                        <span className="text-[10px]">{format(new Date(log.created_at), 'MMM d, yyyy HH:mm')}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// ── Permissions & Roles Tab ───────────────────────────────────────────────────

function PermissionsTab({ guilds, user }: { guilds: GuildConfig[]; user: any }) {
  const [selectedGuildId, setSelectedGuildId] = useState(guilds[0]?.guild_id ?? '');
  const [adminRoles, setAdminRoles] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);

  const COMMAND_GROUPS = [
    { key: 'voice', label: '24/7 Voice commands', commands: ['/join', '/leave', '/forceleave', '/setvc'] },
    { key: 'welcome', label: 'Welcome commands', commands: ['/welcome', '/welcome test', '/welcome testleave'] },
    { key: 'streamer', label: 'Streamer alerts', commands: ['/addstreamer', '/removestreamer', '/liststreamers'] },
    { key: 'game', label: 'Game alerts', commands: ['/addgame', '/removegame', '/listgames'] },
    { key: 'moderation', label: 'Moderation', commands: ['/ban', '/kick', '/timeout', '/warn'] },
  ];

  const currentRoles = adminRoles[selectedGuildId] ?? [];

  const toggleRole = (roleId: string) => {
    const current = adminRoles[selectedGuildId] ?? [];
    const updated = current.includes(roleId)
      ? current.filter((r) => r !== roleId)
      : [...current, roleId];
    setAdminRoles((prev) => ({ ...prev, [selectedGuildId]: updated }));
  };

  const saveRoles = async () => {
    setSaving(true);
    if (user) {
      await insertAuditLog({
        guild_id: selectedGuildId,
        actor_discord_id: user.discordId,
        actor_username: user.username,
        action: 'Updated bot-admin roles',
        category: 'system',
        details: { roles: currentRoles },
      });
    }
    toast.success('Permissions saved');
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-base">Server</CardTitle>
          <CardDescription>Select which server's permissions to configure.</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedGuildId} onValueChange={setSelectedGuildId}>
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {guilds.map((g) => (
                <SelectItem key={g.guild_id} value={g.guild_id}>{g.guild_name || g.guild_id}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Bot-admin roles */}
      <Card className="glass">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-base">Bot-admin roles</CardTitle>
              <CardDescription>Roles that can use admin-only bot commands in this server.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {DEMO_ROLES.map((role) => (
            <div key={role.id} className="flex items-center justify-between rounded-lg border border-border/60 bg-background-elevated/40 p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Shield className="h-4 w-4" />
                </div>
                <span className="text-sm font-medium text-foreground">@{role.name}</span>
              </div>
              <Switch
                checked={currentRoles.includes(role.id)}
                onCheckedChange={() => toggleRole(role.id)}
              />
            </div>
          ))}
          <Button onClick={saveRoles} disabled={saving} className="w-full gap-2">
            <Lock className="h-4 w-4" />
            Save permissions
          </Button>
        </CardContent>
      </Card>

      {/* Command groups */}
      <div className="grid gap-4 sm:grid-cols-2">
        {COMMAND_GROUPS.map((group) => (
          <Card key={group.key} className="glass">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">{group.label}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {group.commands.map((cmd) => (
                <div key={cmd} className="flex items-center justify-between rounded-md border border-border/40 bg-muted/30 px-3 py-2">
                  <code className="text-xs text-foreground">{cmd}</code>
                  <Select defaultValue="admin">
                    <SelectTrigger className="h-7 w-28 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="everyone">Everyone</SelectItem>
                      <SelectItem value="admin">Admins</SelectItem>
                      <SelectItem value="owner">Owner only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
