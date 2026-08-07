'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Bell,
  Edit3,
  Github,
  Plus,
  Rss,
  Save,
  Send,
  Trash2,
  Twitch,
  Webhook as WebhookIcon,
  Youtube,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/providers/auth-provider';
import { supabase } from '@/lib/supabase';
import { insertAuditLog } from '@/lib/data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

type WebhookType = 'custom' | 'twitch' | 'youtube' | 'github' | 'rss';

interface WebhookConfig {
  id: string;
  guild_id: string;
  name: string;
  webhook_url: string;
  channel_id: string | null;
  avatar_url: string | null;
  username: string | null;
  type: WebhookType;
  trigger_config: Record<string, unknown> | null;
  enabled: boolean;
  last_triggered_at: string | null;
  total_sent: number;
  created_at: string;
}

const TYPE_META: Record<
  WebhookType,
  { label: string; icon: React.ComponentType<{ className?: string }>; description: string; accent: string }
> = {
  custom: { label: 'Custom', icon: WebhookIcon, description: 'Manual payload to any Discord webhook URL.', accent: 'text-foreground' },
  twitch: { label: 'Twitch', icon: Twitch, description: 'Post when a Twitch streamer goes live.', accent: 'text-purple-500' },
  youtube: { label: 'YouTube', icon: Youtube, description: 'Post when a new video is uploaded.', accent: 'text-red-500' },
  github: { label: 'GitHub', icon: Github, description: 'Forward repository events (push, release, issues).', accent: 'text-foreground' },
  rss: { label: 'RSS', icon: Rss, description: 'Poll an RSS feed and post new entries.', accent: 'text-orange-500' },
};

const webhookSchema = z.object({
  name: z.string().min(1, 'Name is required').max(64),
  type: z.enum(['custom', 'twitch', 'youtube', 'github', 'rss']),
  webhook_url: z.string().url('Must be a valid URL').or(z.literal('')),
  channel_id: z.string().optional().default(''),
  avatar_url: z.string().url('Must be a valid URL').or(z.literal('')).optional().default(''),
  username: z.string().max(32).optional().default(''),
  trigger_config: z.string().optional().default(''),
  enabled: z.boolean().default(true),
});
type WebhookFormValues = z.infer<typeof webhookSchema>;

// ── Page ───────────────────────────────────────────────────────────────────────

export default function WebhooksPage() {
  const params = useParams<{ guildId: string }>();
  const guildId = params.guildId;
  const { user } = useAuth();

  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<WebhookConfig | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WebhookConfig | null>(null);

  const form = useForm<WebhookFormValues>({
    resolver: zodResolver(webhookSchema),
    defaultValues: {
      name: '',
      type: 'custom',
      webhook_url: '',
      channel_id: '',
      avatar_url: '',
      username: '',
      trigger_config: '',
      enabled: true,
    },
  });

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('webhook_configs')
      .select('*')
      .eq('guild_id', guildId)
      .order('created_at', { ascending: false });
    if (error) toast.error('Failed to load webhooks');
    else setWebhooks((data ?? []) as WebhookConfig[]);
    setLoading(false);
  }, [guildId]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    form.reset({
      name: '',
      type: 'custom',
      webhook_url: '',
      channel_id: '',
      avatar_url: '',
      username: '',
      trigger_config: '',
      enabled: true,
    });
    setDialogOpen(true);
  };

  const openEdit = (w: WebhookConfig) => {
    setEditing(w);
    form.reset({
      name: w.name,
      type: w.type,
      webhook_url: w.webhook_url,
      channel_id: w.channel_id ?? '',
      avatar_url: w.avatar_url ?? '',
      username: w.username ?? '',
      trigger_config: w.trigger_config ? JSON.stringify(w.trigger_config, null, 2) : '',
      enabled: w.enabled,
    });
    setDialogOpen(true);
  };

  const onSubmit = async (v: WebhookFormValues) => {
    let triggerConfig: Record<string, unknown> | null = null;
    if (v.trigger_config) {
      try {
        triggerConfig = JSON.parse(v.trigger_config);
      } catch {
        toast.error('Trigger config is not valid JSON');
        return;
      }
    }
    const payload = {
      guild_id: guildId,
      name: v.name,
      type: v.type,
      webhook_url: v.webhook_url || null,
      channel_id: v.channel_id || null,
      avatar_url: v.avatar_url || null,
      username: v.username || null,
      trigger_config: triggerConfig,
      enabled: v.enabled,
    };
    if (editing) {
      const { error } = await supabase
        .from('webhook_configs')
        .update(payload)
        .eq('id', editing.id);
      if (error) return toast.error(error.message);
      toast.success('Webhook updated');
      if (user) {
        await insertAuditLog({
          guild_id: guildId,
          actor_discord_id: user.discordId,
          actor_username: user.username,
          action: `Updated webhook: ${v.name}`,
          category: 'system',
          details: { name: v.name, type: v.type },
        });
      }
    } else {
      const { error } = await supabase.from('webhook_configs').insert(payload);
      if (error) return toast.error(error.message);
      toast.success('Webhook created');
      if (user) {
        await insertAuditLog({
          guild_id: guildId,
          actor_discord_id: user.discordId,
          actor_username: user.username,
          action: `Created webhook: ${v.name}`,
          category: 'system',
          details: { name: v.name, type: v.type },
        });
      }
    }
    setDialogOpen(false);
    load();
  };

  const toggleEnabled = async (w: WebhookConfig, enabled: boolean) => {
    const { error } = await supabase
      .from('webhook_configs')
      .update({ enabled })
      .eq('id', w.id);
    if (error) return toast.error(error.message);
    toast.success(`Webhook "${w.name}" ${enabled ? 'enabled' : 'disabled'}`);
    setWebhooks((prev) =>
      prev.map((x) => (x.id === w.id ? { ...x, enabled } : x))
    );
  };

  const testFire = async (w: WebhookConfig) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/guilds/${guildId}/webhooks/test?webhookId=${w.id}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      toast.success('Test message sent');
      load();
    } catch (e) {
      toast.error('Test failed: ' + (e as Error).message);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase
      .from('webhook_configs')
      .delete()
      .eq('id', deleteTarget.id);
    if (error) return toast.error(error.message);
    toast.success('Webhook deleted');
    if (user) {
      await insertAuditLog({
        guild_id: guildId,
        actor_discord_id: user.discordId,
        actor_username: user.username,
        action: `Deleted webhook: ${deleteTarget.name}`,
        category: 'system',
        details: { name: deleteTarget.name },
      });
    }
    setDeleteTarget(null);
    load();
  };

  const watchedType = form.watch('type');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <WebhookIcon className="h-6 w-6 text-primary" />
            Webhook Manager
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Route Discord webhooks for external events: Twitch, YouTube, GitHub, RSS, and custom payloads.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          New Webhook
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {[...Array(2)].map((_, i) => (
            <Card key={i} className="h-40 animate-pulse bg-muted/30" />
          ))}
        </div>
      ) : webhooks.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <Bell className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h3 className="text-base font-semibold">No webhooks configured</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Add a webhook to start forwarding events from external services into your server.
              </p>
            </div>
            <Button onClick={openCreate} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Webhook
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {webhooks.map((w) => {
            const meta = TYPE_META[w.type];
            const Icon = meta.icon;
            return (
              <Card key={w.id} className={cn(!w.enabled && 'opacity-60')}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <Icon className={cn('h-5 w-5', meta.accent)} />
                      </div>
                      <div>
                        <CardTitle className="text-base">{w.name}</CardTitle>
                        <CardDescription className="text-xs">
                          {meta.label} · {w.total_sent} sent
                        </CardDescription>
                      </div>
                    </div>
                    <Switch
                      checked={w.enabled}
                      onCheckedChange={(v) => toggleEnabled(w, v)}
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-md border border-border/60 bg-muted/30 p-2 text-xs text-muted-foreground">
                    <div className="truncate">
                      <span className="text-foreground/60">URL:</span>{' '}
                      <code className="font-mono">
                        {w.webhook_url ? w.webhook_url.slice(0, 50) + '...' : '—'}
                      </code>
                    </div>
                    {w.channel_id && (
                      <div className="mt-1">
                        <span className="text-foreground/60">Channel:</span>{' '}
                        <code className="font-mono">{w.channel_id}</code>
                      </div>
                    )}
                    {w.last_triggered_at && (
                      <div className="mt-1">
                        <span className="text-foreground/60">Last fired:</span>{' '}
                        {new Date(w.last_triggered_at).toLocaleString()}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-xs"
                      onClick={() => testFire(w)}
                      disabled={!w.webhook_url}
                    >
                      <Send className="h-3.5 w-3.5" />
                      Test
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1.5 text-xs"
                      onClick={() => openEdit(w)}
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1.5 text-xs text-destructive"
                      onClick={() => setDeleteTarget(w)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <WebhookIcon className="h-5 w-5 text-primary" />
              {editing ? 'Edit Webhook' : 'New Webhook'}
            </DialogTitle>
            <DialogDescription>
              Configure where and how external events are forwarded.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="name">Name</Label>
                <Input id="name" {...form.register('name')} placeholder="Twitch Live Alerts" />
                {form.formState.errors.name && (
                  <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="type">Type</Label>
                <Select
                  value={watchedType}
                  onValueChange={(v) => form.setValue('type', v as WebhookType)}
                >
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TYPE_META) as WebhookType[]).map((t) => {
                      const M = TYPE_META[t];
                      const Icon = M.icon;
                      return (
                        <SelectItem key={t} value={t}>
                          <span className="flex items-center gap-2">
                            <Icon className={cn('h-4 w-4', M.accent)} />
                            {M.label}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{TYPE_META[watchedType].description}</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="webhook_url">Discord Webhook URL</Label>
              <Input
                id="webhook_url"
                {...form.register('webhook_url')}
                placeholder="https://discord.com/api/webhooks/..."
              />
              {form.formState.errors.webhook_url && (
                <p className="text-xs text-destructive">{form.formState.errors.webhook_url.message}</p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="channel_id">Channel ID (optional)</Label>
                <Input id="channel_id" {...form.register('channel_id')} placeholder="For tracking only" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="username">Override Username</Label>
                <Input id="username" {...form.register('username')} placeholder="POW Bot" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="avatar_url">Override Avatar URL (optional)</Label>
              <Input id="avatar_url" {...form.register('avatar_url')} placeholder="https://..." />
            </div>

            <Separator />

            <div className="space-y-1.5">
              <Label htmlFor="trigger_config">
                Trigger Config (JSON)
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  Type-specific parameters
                </span>
              </Label>
              <Textarea
                id="trigger_config"
                rows={5}
                className="font-mono text-xs"
                {...form.register('trigger_config')}
                placeholder={
                  watchedType === 'twitch'
                    ? '{"streamers":["shroud","summit1g"],"message":"{streamer} is live!"}'
                    : watchedType === 'youtube'
                    ? '{"channel_id":"UC...","filter":["upload"]}'
                    : watchedType === 'github'
                    ? '{"repo":"owner/repo","events":["push","release"]}'
                    : watchedType === 'rss'
                    ? '{"feed_url":"https://example.com/rss","poll_minutes":15}'
                    : '{}'
                }
              />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={form.watch('enabled')}
                onCheckedChange={(v) => form.setValue('enabled', v)}
              />
              Enabled
            </label>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="gap-2">
                <Save className="h-4 w-4" />
                {editing ? 'Save' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete webhook "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              The webhook URL and all trigger configuration will be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
