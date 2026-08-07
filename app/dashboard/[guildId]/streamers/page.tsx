'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Circle,
  Plus,
  Radio,
  Trash2,
  Youtube,
} from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { fetchStreamers, insertAuditLog } from '@/lib/data';
import type { StreamerPlatform, StreamerSubscription } from '@/types';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { relativeTime } from '@/lib/data';

const PLATFORM_META: Record<
  StreamerPlatform,
  { label: string; color: string; icon: React.ComponentType<{ className?: string }> }
> = {
  twitch: { label: 'Twitch', color: 'text-chart-4 bg-chart-4/10', icon: Radio },
  kick: { label: 'Kick', color: 'text-success bg-success/10', icon: Radio },
  youtube: { label: 'YouTube', color: 'text-destructive bg-destructive/10', icon: Youtube },
};

const DEMO_TEXT_CHANNELS = [
  { id: '9182736451029384', name: 'stream-alerts' },
  { id: '9182736451029388', name: 'general' },
];

const DEMO_ROLES = [
  { id: '9182736451029398', name: 'Live Ping' },
  { id: '9182736451029399', name: '@everyone' },
];

export default function StreamersPage() {
  const params = useParams<{ guildId: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const [streamers, setStreamers] = useState<StreamerSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    platform: 'twitch' as StreamerPlatform,
    url: '',
    channelId: DEMO_TEXT_CHANNELS[0].id,
    roleId: '',
    displayName: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user || !params?.guildId) return;
    (async () => {
      const s = await fetchStreamers(params.guildId);
      setStreamers(s);
      setLoading(false);
    })();
  }, [user, params?.guildId]);

  const addStreamer = async () => {
    if (!form.url || !params?.guildId || !user) return;
    setSaving(true);
    const username = form.url
      .replace(/^https?:\/\/(www\.)?(twitch\.tv|kick\.com|youtube\.com|youtu\.be)\//, '')
      .replace(/^@/, '')
      .replace(/\/.*$/, '');
    if (!username) {
      toast({ title: 'Invalid URL', variant: 'destructive' });
      setSaving(false);
      return;
    }
    const { data, error } = await supabase
      .from('streamer_subscriptions')
      .insert({
        guild_id: params.guildId,
        platform: form.platform,
        username,
        display_name: form.displayName || username,
        discord_channel_id: form.channelId,
        role_id: form.roleId || null,
        is_live: false,
      })
      .select()
      .single();
    if (error) {
      toast({ title: 'Add failed', description: error.message, variant: 'destructive' });
      setSaving(false);
      return;
    }
    setStreamers([data as StreamerSubscription, ...streamers]);
    await insertAuditLog({
      guild_id: params.guildId,
      actor_discord_id: user.discordId,
      actor_username: user.username,
      action: `Added streamer ${form.displayName || username} (${form.platform})`,
      category: 'streamers',
      details: { platform: form.platform, username },
    });
    toast({
      title: 'Streamer added',
      description: `Now watching ${form.displayName || username} on ${form.platform}.`,
    });
    setForm({ platform: 'twitch', url: '', channelId: DEMO_TEXT_CHANNELS[0].id, roleId: '', displayName: '' });
    setOpen(false);
    setSaving(false);
  };

  const removeStreamer = async (id: number, name: string, platform: StreamerPlatform) => {
    const { error } = await supabase
      .from('streamer_subscriptions')
      .delete()
      .eq('id', id);
    if (error) {
      toast({ title: 'Remove failed', description: error.message, variant: 'destructive' });
      return;
    }
    setStreamers(streamers.filter((s) => s.id !== id));
    if (user && params?.guildId) {
      await insertAuditLog({
        guild_id: params.guildId,
        actor_discord_id: user.discordId,
        actor_username: user.username,
        action: `Removed streamer ${name} (${platform})`,
        category: 'streamers',
        details: { platform, username: name },
      });
    }
    toast({ title: 'Streamer removed' });
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Radio className="h-6 w-6 animate-pulse text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Streamer Alerts
          </h2>
          <p className="text-sm text-muted-foreground">
            Watch Kick, Twitch, and YouTube — get pinged the moment someone goes
            live.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add streamer
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add a streamer</DialogTitle>
              <DialogDescription>
                Paste their channel link. The bot will resolve the handle and
                start watching.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Platform</Label>
                <Select
                  value={form.platform}
                  onValueChange={(v) => setForm({ ...form, platform: v as StreamerPlatform })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="twitch">Twitch</SelectItem>
                    <SelectItem value="kick">Kick</SelectItem>
                    <SelectItem value="youtube">YouTube</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Channel URL</Label>
                <Input
                  placeholder="https://twitch.tv/shroud"
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Post to</Label>
                  <Select
                    value={form.channelId}
                    onValueChange={(v) => setForm({ ...form, channelId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DEMO_TEXT_CHANNELS.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          # {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Ping role (optional)</Label>
                  <Select
                    value={form.roleId || '__none'}
                    onValueChange={(v) => setForm({ ...form, roleId: v === '__none' ? '' : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">— No ping —</SelectItem>
                      {DEMO_ROLES.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          @ {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Display name override (optional)</Label>
                <Input
                  placeholder="Defaults to the channel handle"
                  value={form.displayName}
                  onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={addStreamer} disabled={saving || !form.url}>
                {saving ? 'Adding…' : 'Add streamer'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {streamers.length === 0 ? (
        <Card className="glass p-12 text-center">
          <Radio className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
          <p className="text-muted-foreground">
            No streamers being watched yet. Click "Add streamer" to start.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {streamers.map((s) => {
            const meta = PLATFORM_META[s.platform];
            const Icon = meta.icon;
            return (
              <Card key={s.id} className="glass">
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div
                      className={cn(
                        'flex h-12 w-12 items-center justify-center rounded-xl',
                        meta.color
                      )}
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-semibold text-foreground">
                          {s.display_name || s.username}
                        </span>
                        {s.is_live ? (
                          <Badge
                            variant="outline"
                            className="border-destructive/30 bg-destructive/10 text-destructive"
                          >
                            <Circle className="mr-1 h-2 w-2 fill-current" />
                            LIVE
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            Offline
                          </Badge>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {meta.label} · @{s.username}
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        Posting to{' '}
                        <span className="text-foreground">
                          # {DEMO_TEXT_CHANNELS.find((c) => c.id === s.discord_channel_id)?.name || s.discord_channel_id}
                        </span>
                        {s.role_id && (
                          <>
                            {' · pinging '}
                            <span className="text-foreground">
                              @ {DEMO_ROLES.find((r) => r.id === s.role_id)?.name || 'role'}
                            </span>
                          </>
                        )}
                      </div>
                      {s.last_stream_title && (
                        <div className="mt-2 truncate text-xs text-muted-foreground">
                          Last stream: {s.last_stream_title}
                        </div>
                      )}
                      {s.last_went_live && (
                        <div className="text-xs text-muted-foreground">
                          Last live {relativeTime(s.last_went_live)}
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => removeStreamer(s.id, s.display_name || s.username, s.platform)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
