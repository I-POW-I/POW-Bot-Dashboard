'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  CheckCircle2,
  Mail,
  ShieldCheck,
  Sparkles,
  UserPlus,
} from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { fetchGuildConfig, insertAuditLog } from '@/lib/data';
import type { GuildConfig } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

const DEMO_TEXT_CHANNELS = [
  { id: '9182736451029390', name: 'welcome' },
  { id: '9182736451029391', name: 'goodbye' },
  { id: '9182736451029388', name: 'general' },
  { id: '9182736451029389', name: 'bot-commands' },
];

const DEMO_ROLES = [
  { id: '9182736451029392', name: 'Verified' },
  { id: '9182736451029394', name: 'Member' },
  { id: '9182736451029396', name: 'VIP' },
  { id: '9182736451029397', name: 'Booster' },
];

export default function WelcomeVerifyPage() {
  const params = useParams<{ guildId: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const [config, setConfig] = useState<GuildConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [previewEvent, setPreviewEvent] = useState<'join' | 'leave'>('join');
  const [verifyTitle, setVerifyTitle] = useState('Click it... I know you want too.');
  const [verifyDesc, setVerifyDesc] = useState('');

  useEffect(() => {
    if (!user || !params?.guildId) return;
    (async () => {
      const c = await fetchGuildConfig(params.guildId);
      setConfig(c);
      setLoading(false);
    })();
  }, [user, params?.guildId]);

  const updateConfig = async (updates: Partial<GuildConfig>, logAction?: string) => {
    if (!config || !params?.guildId || !user) return false;
    setBusy(true);
    const { error } = await supabase
      .from('guild_configs')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('guild_id', params.guildId);
    if (error) {
      toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
      setBusy(false);
      return false;
    }
    const fresh = await fetchGuildConfig(params.guildId);
    setConfig(fresh);
    if (logAction) {
      await insertAuditLog({
        guild_id: params.guildId,
        actor_discord_id: user.discordId,
        actor_username: user.username,
        action: logAction,
        category: updates.verify_role_id ? 'verification' : 'welcome',
        details: updates as Record<string, unknown>,
      });
    }
    setBusy(false);
    return true;
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Sparkles className="h-6 w-6 animate-pulse text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Welcome & Verification
        </h2>
        <p className="text-sm text-muted-foreground">
          Configure welcome / leave cards and the one-click verification button.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Welcome / leave channels */}
        <Card className="glass">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-chart-4/10 text-chart-4">
                <UserPlus className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">Welcome & leave cards</CardTitle>
                <CardDescription>
                  Canvas-rendered images with avatar and member count.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Welcome channel
              </Label>
              <Select
                value={config?.welcome_channel_id || '__none'}
                onValueChange={(v) =>
                  updateConfig(
                    { welcome_channel_id: v === '__none' ? null : v },
                    v === '__none'
                      ? 'Cleared welcome channel'
                      : `Set welcome channel to #${
                          DEMO_TEXT_CHANNELS.find((c) => c.id === v)?.name
                        }`
                  )
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
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Leave channel
              </Label>
              <Select
                value={config?.leave_channel_id || config?.welcome_channel_id || '__none'}
                onValueChange={(v) =>
                  updateConfig(
                    { leave_channel_id: v === '__none' ? null : v },
                    v === '__none'
                      ? 'Cleared leave channel'
                      : `Set leave channel to #${
                          DEMO_TEXT_CHANNELS.find((c) => c.id === v)?.name
                        }`
                  )
                }
                disabled={busy}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Defaults to welcome channel…" />
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
            </div>

            {/* Preview card — join / leave toggle */}
            <div className="space-y-3">
              <div className="flex gap-1">
                {(['join', 'leave'] as const).map((ev) => (
                  <button
                    key={ev}
                    type="button"
                    onClick={() => setPreviewEvent(ev)}
                    className={cn(
                      'rounded px-3 py-1 text-xs font-medium transition-colors',
                      previewEvent === ev
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {ev === 'join' ? 'Join preview' : 'Leave preview'}
                  </button>
                ))}
              </div>

              {/* Discord-style embed card */}
              <div className={cn(
                'overflow-hidden rounded-xl border-l-4 bg-[#1e1f2e]',
                previewEvent === 'join' ? 'border-l-success' : 'border-l-chart-4'
              )}>
                <div className="flex flex-col items-center px-6 py-7 text-center">
                  {/* Avatar */}
                  <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-chart-4 to-primary text-2xl font-bold text-primary-foreground ring-4 ring-white/10">
                    P
                  </div>

                  {/* Server nickname — large bold */}
                  <p className="text-2xl font-bold tracking-tight text-white" style={{ fontFamily: 'Courier New, monospace' }}>
                    PowUser
                  </p>

                  {/* Event label */}
                  <p className="mt-1.5 text-sm font-medium text-[#a0a5b0]">
                    {previewEvent === 'join' ? 'Joined' : 'Left'}
                  </p>

                  {/* Discord @username */}
                  <p className="mt-0.5 text-xs text-[#7289da]">@pow_user</p>

                  {/* Server join date */}
                  <p className="mt-3 text-xs text-[#72767d]">
                    Joined: January 15, 2024
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <CheckCircle2 className="h-3 w-3 text-success" />
                Nickname shown if set, otherwise display name · @username always the Discord handle
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-background-elevated/40 p-3 text-xs text-muted-foreground">
              <Mail className="h-3.5 w-3.5" />
              Use <code className="rounded bg-muted px-1 py-0.5">/welcome test</code>{' '}
              and{' '}
              <code className="rounded bg-muted px-1 py-0.5">/welcome testleave</code>{' '}
              in Discord to preview your own card.
            </div>
          </CardContent>
        </Card>

        {/* Verification */}
        <Card className="glass">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/10 text-warning">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">Verification button</CardTitle>
                <CardDescription>
                  Post an embed with a verify button that grants a role.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Role to grant on verify
              </Label>
              <Select
                value={config?.verify_role_id || '__none'}
                onValueChange={(v) =>
                  updateConfig(
                    { verify_role_id: v === '__none' ? null : v },
                    v === '__none'
                      ? 'Cleared verification role'
                      : `Set verification role to @${DEMO_ROLES.find((r) => r.id === v)?.name}`
                  )
                }
                disabled={busy}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a role…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">— Disabled —</SelectItem>
                  {DEMO_ROLES.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      @ {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Embed title
              </Label>
              <Input
                value={verifyTitle}
                onChange={(e) => setVerifyTitle(e.target.value)}
                placeholder="Click it... I know you want too."
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Embed description (optional)
              </Label>
              <Input
                value={verifyDesc}
                onChange={(e) => setVerifyDesc(e.target.value)}
                placeholder="Read the rules, then click the button to verify."
              />
            </div>

            {/* Preview */}
            <div className="overflow-hidden rounded-xl border-l-4 border-l-destructive bg-background-elevated p-4">
              <div className="text-sm font-semibold text-foreground">
                {verifyTitle || 'Click it... I know you want too.'}
              </div>
              {verifyDesc && (
                <div className="mt-1 text-xs text-muted-foreground">
                  {verifyDesc}
                </div>
              )}
              <Button
                size="sm"
                className="mt-3 gap-1.5 bg-success text-success-foreground hover:bg-success/90"
                disabled
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Verify
              </Button>
            </div>

            <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-warning" />
              The bot must have a role higher than the one it assigns. Move the
              bot's role above it in Server Settings → Roles.
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bot control role */}
      <Card className="glass">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">Bot control role</CardTitle>
              <CardDescription>
                Who can use the Leave and Force Leave buttons on the live panel.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Control role
              </Label>
              <Select
                value={config?.bot_control_role_id || '__none'}
                onValueChange={(v) =>
                  updateConfig(
                    { bot_control_role_id: v === '__none' ? null : v },
                    v === '__none'
                      ? 'Cleared bot control role'
                      : `Set bot control role to @${DEMO_ROLES.find((r) => r.id === v)?.name}`
                  )
                }
                disabled={busy}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Defaults to server owner…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">— Server owner only —</SelectItem>
                  {DEMO_ROLES.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      @ {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div
              className={cn(
                'flex items-center gap-2 rounded-lg border border-border/60 bg-background-elevated/40 p-3 text-xs text-muted-foreground'
              )}
            >
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              If unset, only the server owner can use Leave / Force Leave. Set a
              role to delegate this to mods.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
