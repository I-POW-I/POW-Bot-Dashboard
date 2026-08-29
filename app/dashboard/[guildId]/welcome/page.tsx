'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  CheckCircle2,
  Mail,
  Palette,
  ShieldCheck,
  Sparkles,
  UserPlus,
} from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { fetchGuildConfig, insertAuditLog } from '@/lib/data';
import type { GuildConfig, WelcomeCardConfig } from '@/types';
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

interface RealChannel { id: string; name: string; position: number }
interface RealRole { id: string; name: string; color: string; position: number }

const ACCENT_PRESETS = ['#5865F2', '#57F287', '#FEE75C', '#EB459E', '#ED4245', '#747F8D'];

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

  const [channels, setChannels] = useState<RealChannel[]>([]);
  const [roles, setRoles] = useState<RealRole[]>([]);
  const [channelsError, setChannelsError] = useState<string | null>(null);

  // Draft card style — separate from `config` so the preview updates
  // instantly as you adjust controls, without a DB write per click. "Save
  // card style" commits it via updateConfig, same as everything else here.
  const [cardDraft, setCardDraft] = useState<WelcomeCardConfig>({
    nameMode: 'nickname',
    accentColor: null,
    avatarPosition: 'center',
    textAlign: 'center',
  });
  const [cardDraftDirty, setCardDraftDirty] = useState(false);
  const [previewNonce, setPreviewNonce] = useState(0);

  useEffect(() => {
    if (!user || !params?.guildId) return;
    (async () => {
      const [c, chRes, roleRes] = await Promise.all([
        fetchGuildConfig(params.guildId),
        fetch(`/api/bot/guilds/${params.guildId}/channels`).then((r) => r.json()).catch(() => ({ channels: [], error: 'Request failed' })),
        fetch(`/api/bot/guilds/${params.guildId}/roles`).then((r) => r.json()).catch(() => ({ roles: [], error: 'Request failed' })),
      ]);
      setConfig(c);
      setChannels(chRes.channels || []);
      setRoles(roleRes.roles || []);
      setChannelsError(chRes.error || roleRes.error || null);
      if (c?.welcome_card_config && Object.keys(c.welcome_card_config).length) {
        setCardDraft({
          nameMode: c.welcome_card_config.nameMode || 'nickname',
          accentColor: c.welcome_card_config.accentColor || null,
          avatarPosition: c.welcome_card_config.avatarPosition || 'center',
          textAlign: c.welcome_card_config.textAlign || 'center',
        });
      }
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

  const saveCardStyle = async () => {
    const ok = await updateConfig(
      { welcome_card_config: cardDraft },
      'Updated welcome/leave card style'
    );
    if (ok) {
      setCardDraftDirty(false);
      toast({ title: 'Card style saved' });
    }
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
                          channels.find((c) => c.id === v)?.name
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
                  {channels.map((c) => (
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
                          channels.find((c) => c.id === v)?.name
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
                  {channels.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      # {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Card style customization */}
            <div className="space-y-3 rounded-lg border border-border/60 p-3">
              <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <Palette className="h-3.5 w-3.5" />
                Card style
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Name shown</Label>
                  <Select
                    value={cardDraft.nameMode}
                    onValueChange={(v) => {
                      setCardDraft((d) => ({ ...d, nameMode: v as WelcomeCardConfig['nameMode'] }));
                      setCardDraftDirty(true);
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nickname">Server nickname</SelectItem>
                      <SelectItem value="username">Discord username</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Avatar position</Label>
                  <Select
                    value={cardDraft.avatarPosition}
                    onValueChange={(v) => {
                      setCardDraft((d) => ({ ...d, avatarPosition: v as WelcomeCardConfig['avatarPosition'] }));
                      setCardDraftDirty(true);
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="left">Left</SelectItem>
                      <SelectItem value="center">Center</SelectItem>
                      <SelectItem value="right">Right</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Text alignment</Label>
                  <Select
                    value={cardDraft.textAlign}
                    onValueChange={(v) => {
                      setCardDraft((d) => ({ ...d, textAlign: v as WelcomeCardConfig['textAlign'] }));
                      setCardDraftDirty(true);
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="left">Left</SelectItem>
                      <SelectItem value="center">Center</SelectItem>
                      <SelectItem value="right">Right</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Accent color</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {ACCENT_PRESETS.map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        onClick={() => {
                          setCardDraft((d) => ({ ...d, accentColor: hex }));
                          setCardDraftDirty(true);
                        }}
                        className={cn(
                          'h-7 w-7 rounded-full border-2 transition-transform hover:scale-110',
                          cardDraft.accentColor === hex ? 'border-foreground' : 'border-transparent'
                        )}
                        style={{ backgroundColor: hex }}
                        title={hex}
                      />
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        setCardDraft((d) => ({ ...d, accentColor: null }));
                        setCardDraftDirty(true);
                      }}
                      className={cn(
                        'flex h-7 items-center rounded-full border px-2 text-[10px] text-muted-foreground',
                        !cardDraft.accentColor ? 'border-foreground text-foreground' : 'border-border/60'
                      )}
                    >
                      Default
                    </button>
                  </div>
                </div>
              </div>

              {cardDraftDirty && (
                <Button size="sm" onClick={saveCardStyle} disabled={busy} className="w-full">
                  Save card style
                </Button>
              )}
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

              {/* Real card, rendered by the bot itself — not a mockup. Query
                  string reflects the current draft so it updates live as you
                  adjust the controls above, before you even save. */}
              <div className="overflow-hidden rounded-xl border border-border/60 bg-[#1e1f2e] p-2">
                {channelsError ? (
                  <div className="flex h-40 flex-col items-center justify-center gap-1 text-center text-xs text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    Bot unreachable — live preview needs the bot's HTTP
                    connection configured (BOT_HTTP_URL on the dashboard).
                  </div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={`${previewEvent}-${JSON.stringify(cardDraft)}-${previewNonce}`}
                    src={`/api/bot/guilds/${params.guildId}/welcome-preview?type=${
                      previewEvent === 'join' ? 'welcome' : 'leave'
                    }&nameMode=${cardDraft.nameMode}&accentColor=${encodeURIComponent(
                      cardDraft.accentColor || ''
                    )}&avatarPosition=${cardDraft.avatarPosition}&textAlign=${cardDraft.textAlign}`}
                    alt={`${previewEvent === 'join' ? 'Welcome' : 'Leave'} card preview`}
                    className="w-full rounded-lg"
                    onError={() => setChannelsError('Preview failed to load — is the bot online?')}
                  />
                )}
              </div>

              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <CheckCircle2 className="h-3 w-3 text-success" />
                This is the exact image the bot will post — rendered live, using your own Discord avatar and name.
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-background-elevated/40 p-3 text-xs text-muted-foreground">
              <Mail className="h-3.5 w-3.5" />
              Use <code className="rounded bg-muted px-1 py-0.5">/welcome test</code>{' '}
              and{' '}
              <code className="rounded bg-muted px-1 py-0.5">/welcome testleave</code>{' '}
              in Discord to preview the same card there too.
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
                      : `Set verification role to @${roles.find((r) => r.id === v)?.name}`
                  )
                }
                disabled={busy}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a role…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">— Disabled —</SelectItem>
                  {roles.map((r) => (
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
                      : `Set bot control role to @${roles.find((r) => r.id === v)?.name}`
                  )
                }
                disabled={busy}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Defaults to server owner…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">— Server owner only —</SelectItem>
                  {roles.map((r) => (
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
