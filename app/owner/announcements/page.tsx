'use client';

import { useEffect, useState } from 'react';
import { Megaphone, Send, Trash2 } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { fetchGuildConfig, insertAuditLog, relativeTime } from '@/lib/data';
import type { Announcement, GuildConfig } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

const COLORS = [
  { name: 'Blurple', value: 0x5865f2 },
  { name: 'Green', value: 0x57f287 },
  { name: 'Red', value: 0xed4245 },
  { name: 'Yellow', value: 0xfee75c },
  { name: 'Fuchsia', value: 0xeb459e },
];

export default function OwnerAnnouncementsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [guilds, setGuilds] = useState<GuildConfig[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [color, setColor] = useState(0x5865f2);
  const [targets, setTargets] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const configs = await Promise.all(
        user.guilds.map((g) => fetchGuildConfig(g.guildId))
      );
      const valid = configs.filter(Boolean) as GuildConfig[];
      setGuilds(valid);
      setTargets(valid.map((g) => g.guild_id));
      const { data } = await supabase.from('announcements').select('*').order('created_at', { ascending: false }).limit(20);
      setAnnouncements((data || []) as Announcement[]);
    })();
  }, [user]);

  const toggleTarget = (guildId: string) => {
    setTargets((prev) =>
      prev.includes(guildId)
        ? prev.filter((g) => g !== guildId)
        : [...prev, guildId]
    );
  };

  const send = async () => {
    if (!title || targets.length === 0 || !user) {
      toast({ title: 'Title and at least one target required', variant: 'destructive' });
      return;
    }
    setSending(true);
    const { data, error } = await supabase
      .from('announcements')
      .insert({
        user_id: (await supabase.auth.getUser()).data.user?.id,
        title,
        body,
        color,
        target_guild_ids: targets,
        status: 'sent',
        sent_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) {
      toast({ title: 'Send failed', description: error.message, variant: 'destructive' });
      setSending(false);
      return;
    }
    const ann = data as Announcement;
    setAnnouncements([ann, ...announcements]);
    await insertAuditLog({
      guild_id: 'global',
      actor_discord_id: user.discordId,
      actor_username: user.username,
      action: `Sent announcement "${title}" to ${targets.length} server(s)`,
      category: 'announcement',
      details: { title, targets },
    });
    toast({
      title: 'Announcement sent',
      description: `Posted to ${targets.length} server(s).`,
    });
    setTitle('');
    setBody('');
    setSending(false);
  };

  const deleteAnn = async (id: string) => {
    const { error } = await supabase.from('announcements').delete().eq('id', id);
    if (error) {
      toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
      return;
    }
    setAnnouncements(announcements.filter((a) => a.id !== id));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Announcement System
        </h1>
        <p className="text-sm text-muted-foreground">
          Send a global embed to all servers at once, or target specific ones.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Composer */}
        <Card className="glass lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Compose announcement</CardTitle>
            <CardDescription>
              Preview the embed before sending. The bot posts to the panel
              channel in each target server.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Title
              </Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Big news from the POW Bot team…"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Body
              </Label>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Type your message here…"
                rows={5}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Embed color
              </Label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setColor(c.value)}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all',
                      color === c.value
                        ? 'border-primary bg-primary/10 text-foreground'
                        : 'border-border/60 text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: `#${c.value.toString(16).padStart(6, '0')}` }}
                    />
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Target servers ({targets.length} selected)
              </Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {guilds.map((g) => (
                  <label
                    key={g.guild_id}
                    className="flex items-center gap-3 rounded-lg border border-border/60 bg-background-elevated/40 p-3 cursor-pointer hover:border-primary/30"
                  >
                    <Checkbox
                      checked={targets.includes(g.guild_id)}
                      onCheckedChange={() => toggleTarget(g.guild_id)}
                    />
                    <span className="truncate text-sm text-foreground">
                      {g.guild_name || 'Unnamed'}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <Button onClick={send} disabled={sending || !title} className="gap-2">
              <Send className="h-4 w-4" />
              {sending ? 'Sending…' : `Send to ${targets.length} server(s)`}
            </Button>
          </CardContent>
        </Card>

        {/* Preview */}
        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-base">Preview</CardTitle>
            <CardDescription>How the embed will appear</CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className="overflow-hidden rounded-lg border-l-4 bg-background-elevated p-4"
              style={{
                borderLeftColor: `#${color.toString(16).padStart(6, '0')}`,
              }}
            >
              <div className="text-sm font-semibold text-foreground">
                {title || 'Your title here'}
              </div>
              {body && (
                <div className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                  {body}
                </div>
              )}
              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <Megaphone className="h-3 w-3" />
                POW Bot · {new Date().toLocaleString()}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* History */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-base">Recent announcements</CardTitle>
          <CardDescription>Last 20 sent</CardDescription>
        </CardHeader>
        <CardContent>
          {announcements.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
              No announcements sent yet.
            </div>
          ) : (
            <div className="space-y-2">
              {announcements.map((a) => (
                <div
                  key={a.id}
                  className="flex items-start gap-3 rounded-lg border border-border/60 bg-background-elevated/40 p-3"
                >
                  <div
                    className="mt-1 h-8 w-1 rounded-full"
                    style={{ backgroundColor: `#${a.color.toString(16).padStart(6, '0')}` }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-foreground">{a.title}</div>
                    {a.body && (
                      <div className="truncate text-xs text-muted-foreground">
                        {a.body}
                      </div>
                    )}
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-xs">
                        {a.target_guild_ids.length} server(s)
                      </Badge>
                      <span>{relativeTime(a.sent_at || a.created_at)}</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteAnn(a.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
