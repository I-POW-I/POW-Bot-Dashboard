'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Check,
  LifeBuoy,
  MessageSquare,
  Save,
  Settings2,
  Ticket,
  X,
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
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

type ButtonStyle = 'primary' | 'secondary' | 'success' | 'danger';

interface TicketConfig {
  id: string;
  guild_id: string;
  enabled: boolean;
  category_id: string | null;
  panel_channel_id: string | null;
  panel_message_id: string | null;
  support_role_id: string | null;
  log_channel_id: string | null;
  welcome_message: string | null;
  max_open_tickets: number;
  auto_close_hours: number;
  claim_button: boolean;
  close_button: boolean;
  transcript_on_close: boolean;
  button_label: string;
  button_emoji: string;
  button_style: ButtonStyle;
}

const STYLE_META: Record<ButtonStyle, { label: string; className: string }> = {
  primary: { label: 'Primary (Blurple)', className: 'bg-primary text-primary-foreground' },
  secondary: { label: 'Secondary (Grey)', className: 'bg-secondary text-secondary-foreground' },
  success: { label: 'Success (Green)', className: 'bg-emerald-600 text-white' },
  danger: { label: 'Danger (Red)', className: 'bg-destructive text-destructive-foreground' },
};

const configSchema = z.object({
  enabled: z.boolean().default(false),
  category_id: z.string().optional().default(''),
  panel_channel_id: z.string().optional().default(''),
  support_role_id: z.string().optional().default(''),
  log_channel_id: z.string().optional().default(''),
  welcome_message: z.string().max(2000).optional().default(''),
  max_open_tickets: z.coerce.number().int().min(1).max(50).default(1),
  auto_close_hours: z.coerce.number().int().min(0).max(168).default(24),
  claim_button: z.boolean().default(true),
  close_button: z.boolean().default(true),
  transcript_on_close: z.boolean().default(true),
  button_label: z.string().min(1).max(80).default('Open Ticket'),
  button_emoji: z.string().max(32).optional().default('🎫'),
  button_style: z.enum(['primary', 'secondary', 'success', 'danger']).default('primary'),
});
type ConfigValues = z.infer<typeof configSchema>;

// ── Page ───────────────────────────────────────────────────────────────────────

export default function TicketsPage() {
  const params = useParams<{ guildId: string }>();
  const guildId = params.guildId;
  const { user } = useAuth();

  const [configId, setConfigId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const form = useForm<ConfigValues>({
    resolver: zodResolver(configSchema),
    defaultValues: {
      enabled: false,
      category_id: '',
      panel_channel_id: '',
      support_role_id: '',
      log_channel_id: '',
      welcome_message: '',
      max_open_tickets: 1,
      auto_close_hours: 24,
      claim_button: true,
      close_button: true,
      transcript_on_close: true,
      button_label: 'Open Ticket',
      button_emoji: '🎫',
      button_style: 'primary',
    },
  });

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('ticket_configs')
      .select('*')
      .eq('guild_id', guildId)
      .maybeSingle();
    if (error) {
      toast.error('Failed to load ticket config');
      setLoading(false);
      return;
    }
    if (data) {
      setConfigId((data as TicketConfig).id);
      form.reset({
        enabled: (data as TicketConfig).enabled,
        category_id: (data as TicketConfig).category_id ?? '',
        panel_channel_id: (data as TicketConfig).panel_channel_id ?? '',
        support_role_id: (data as TicketConfig).support_role_id ?? '',
        log_channel_id: (data as TicketConfig).log_channel_id ?? '',
        welcome_message: (data as TicketConfig).welcome_message ?? '',
        max_open_tickets: (data as TicketConfig).max_open_tickets,
        auto_close_hours: (data as TicketConfig).auto_close_hours,
        claim_button: (data as TicketConfig).claim_button,
        close_button: (data as TicketConfig).close_button,
        transcript_on_close: (data as TicketConfig).transcript_on_close,
        button_label: (data as TicketConfig).button_label,
        button_emoji: (data as TicketConfig).button_emoji ?? '🎫',
        button_style: (data as TicketConfig).button_style,
      });
    }
    setLoading(false);
  }, [guildId, form]);

  useEffect(() => {
    load();
  }, [load]);

  const onSubmit = async (v: ConfigValues) => {
    setSaving(true);
    const payload = {
      guild_id: guildId,
      enabled: v.enabled,
      category_id: v.category_id || null,
      panel_channel_id: v.panel_channel_id || null,
      support_role_id: v.support_role_id || null,
      log_channel_id: v.log_channel_id || null,
      welcome_message: v.welcome_message || null,
      max_open_tickets: v.max_open_tickets,
      auto_close_hours: v.auto_close_hours,
      claim_button: v.claim_button,
      close_button: v.close_button,
      transcript_on_close: v.transcript_on_close,
      button_label: v.button_label,
      button_emoji: v.button_emoji || null,
      button_style: v.button_style,
    };
    if (configId) {
      const { error } = await supabase
        .from('ticket_configs')
        .update(payload)
        .eq('id', configId);
      if (error) {
        toast.error(error.message);
        setSaving(false);
        return;
      }
    } else {
      const { data, error } = await supabase
        .from('ticket_configs')
        .insert(payload)
        .select()
        .single();
      if (error) {
        toast.error(error.message);
        setSaving(false);
        return;
      }
      setConfigId((data as TicketConfig).id);
    }
    toast.success('Ticket system saved');
    if (user) {
      await insertAuditLog({
        guild_id: guildId,
        actor_discord_id: user.discordId,
        actor_username: user.username,
        action: 'Updated ticket system config',
        category: 'system',
        details: { enabled: v.enabled },
      });
    }
    setSaving(false);
  };

  const watched = form.watch();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <LifeBuoy className="h-6 w-6 text-primary" />
            Ticket System
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure a support ticket panel. Members click a button to open a private channel.
          </p>
        </div>
        <Button onClick={form.handleSubmit(onSubmit)} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? 'Saving...' : 'Save Config'}
        </Button>
      </div>

      {loading ? (
        <Card className="h-96 animate-pulse bg-muted/30" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Settings2 className="h-4 w-4" />
                Configuration
              </CardTitle>
              <CardDescription>Channels, roles, and limits.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <label className="flex items-center justify-between rounded-lg border border-border/60 bg-card/40 p-3">
                <div>
                  <div className="text-sm font-medium">Enable ticket system</div>
                  <div className="text-xs text-muted-foreground">
                    Master switch. When off, the panel button stops working.
                  </div>
                </div>
                <Switch
                  checked={form.watch('enabled')}
                  onCheckedChange={(v) => form.setValue('enabled', v)}
                />
              </label>

              <Separator />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="category_id">Ticket Category ID</Label>
                  <Input id="category_id" {...form.register('category_id')} placeholder="Category where ticket channels are created" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="panel_channel_id">Panel Channel ID</Label>
                  <Input id="panel_channel_id" {...form.register('panel_channel_id')} placeholder="Channel where the open-ticket button is posted" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="support_role_id">Support Role ID</Label>
                  <Input id="support_role_id" {...form.register('support_role_id')} placeholder="Role auto-added to tickets" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="log_channel_id">Log Channel ID</Label>
                  <Input id="log_channel_id" {...form.register('log_channel_id')} placeholder="Where closures are logged" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="max_open_tickets">Max Open Tickets / User</Label>
                  <Input id="max_open_tickets" type="number" min={1} max={50} {...form.register('max_open_tickets', { valueAsNumber: true })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="auto_close_hours">Auto-close After (hours)</Label>
                  <Input id="auto_close_hours" type="number" min={0} max={168} {...form.register('auto_close_hours', { valueAsNumber: true })} />
                  <p className="text-xs text-muted-foreground">Set to 0 to disable auto-close.</p>
                </div>
              </div>

              <Separator />

              <div className="space-y-1.5">
                <Label htmlFor="welcome_message">Welcome Message</Label>
                <Textarea
                  id="welcome_message"
                  rows={4}
                  {...form.register('welcome_message')}
                  placeholder="Thanks for opening a ticket. A staff member will be with you shortly."
                />
                <p className="text-xs text-muted-foreground">
                  Use <code className="rounded bg-muted px-1 text-xs">{'{user}'}</code> and <code className="rounded bg-muted px-1 text-xs">{'{ticket}'}</code> as placeholders.
                </p>
              </div>

              <Separator />

              <div className="grid gap-3 sm:grid-cols-3">
                <label className="flex items-center justify-between rounded-lg border border-border/60 bg-card/40 p-3">
                  <span className="text-sm">Claim button</span>
                  <Switch
                    checked={form.watch('claim_button')}
                    onCheckedChange={(v) => form.setValue('claim_button', v)}
                  />
                </label>
                <label className="flex items-center justify-between rounded-lg border border-border/60 bg-card/40 p-3">
                  <span className="text-sm">Close button</span>
                  <Switch
                    checked={form.watch('close_button')}
                    onCheckedChange={(v) => form.setValue('close_button', v)}
                  />
                </label>
                <label className="flex items-center justify-between rounded-lg border border-border/60 bg-card/40 p-3">
                  <span className="text-sm">Transcript on close</span>
                  <Switch
                    checked={form.watch('transcript_on_close')}
                    onCheckedChange={(v) => form.setValue('transcript_on_close', v)}
                  />
                </label>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Ticket className="h-4 w-4" />
                  Panel Button
                </CardTitle>
                <CardDescription>How the open-ticket button looks.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="button_label">Button Label</Label>
                  <Input id="button_label" {...form.register('button_label')} placeholder="Open Ticket" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="button_emoji">Button Emoji</Label>
                    <Input id="button_emoji" {...form.register('button_emoji')} placeholder="🎫" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="button_style">Button Style</Label>
                    <Select
                      value={form.watch('button_style')}
                      onValueChange={(v) => form.setValue('button_style', v as ButtonStyle)}
                    >
                      <SelectTrigger id="button_style">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(STYLE_META) as ButtonStyle[]).map((s) => (
                          <SelectItem key={s} value={s}>
                            {STYLE_META[s].label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Live Preview</CardTitle>
                <CardDescription>What members will see.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border border-border/60 bg-[#313338] p-4">
                  <div className="mb-3 flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-primary">
                      <MessageSquare className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-white">Support Tickets</div>
                      <div className="text-xs text-[#b5bac1]">
                        {watched.welcome_message
                          ? watched.welcome_message.slice(0, 80) + (watched.welcome_message.length > 80 ? '...' : '')
                          : 'Click the button below to open a private ticket with staff.'}
                      </div>
                    </div>
                  </div>
                  <button
                    className={cn(
                      'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
                      STYLE_META[watched.button_style].className
                    )}
                  >
                    <span>{watched.button_emoji || '🎫'}</span>
                    {watched.button_label || 'Open Ticket'}
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Badge variant="outline" className="text-[10px]">
                    Max {watched.max_open_tickets}/user
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    Auto-close {watched.auto_close_hours}h
                  </Badge>
                  {watched.claim_button && (
                    <Badge variant="outline" className="text-[10px]">Claim</Badge>
                  )}
                  {watched.close_button && (
                    <Badge variant="outline" className="text-[10px]">Close</Badge>
                  )}
                  {watched.transcript_on_close && (
                    <Badge variant="outline" className="text-[10px]">Transcript</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
