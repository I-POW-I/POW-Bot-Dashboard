'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Ban, ExternalLink, Search, Server } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { fetchGuildConfig, insertAuditLog } from '@/lib/data';
import type { GuildConfig } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { relativeTime } from '@/lib/data';

export default function OwnerServersPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [guilds, setGuilds] = useState<GuildConfig[]>([]);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'name' | 'recent'>('recent');
  const [blacklist, setBlacklist] = useState<string[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const configs = await Promise.all(
        user.guilds.map((g) => fetchGuildConfig(g.guildId))
      );
      setGuilds(configs.filter(Boolean) as GuildConfig[]);
      const { data } = await supabase.from('blacklist').select('target_id').eq('target_type', 'guild');
      setBlacklist((data || []).map((d: { target_id: string }) => d.target_id));
    })();
  }, [user]);

  const filtered = useMemo(() => {
    const f = guilds.filter((g) =>
      (g.guild_name || '').toLowerCase().includes(query.toLowerCase())
    );
    if (sort === 'name') {
      f.sort((a, b) => (a.guild_name || '').localeCompare(b.guild_name || ''));
    } else {
      f.sort(
        (a, b) =>
          new Date(b.joined_at || 0).getTime() - new Date(a.joined_at || 0).getTime()
      );
    }
    return f;
  }, [guilds, query, sort]);

  const blacklistGuild = async (guildId: string, name: string) => {
    const { error } = await supabase
      .from('blacklist')
      .insert({ target_type: 'guild', target_id: guildId, reason: 'Owner blacklist' });
    if (error && error.code !== '23505') {
      toast({ title: 'Failed', description: error.message, variant: 'destructive' });
      return;
    }
    setBlacklist([...blacklist, guildId]);
    if (user) {
      await insertAuditLog({
        guild_id: guildId,
        actor_discord_id: user.discordId,
        actor_username: user.username,
        action: `Blacklisted server ${name}`,
        category: 'blacklist',
        details: { guildId, name },
      });
    }
    toast({ title: 'Server blacklisted', description: name });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Server Management
        </h1>
        <p className="text-sm text-muted-foreground">
          Search, sort, view, or blacklist any server the bot is in.
        </p>
      </div>

      <Card className="glass">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search servers…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={sort === 'recent' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSort('recent')}
              >
                Recent
              </Button>
              <Button
                variant={sort === 'name' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSort('name')}
              >
                Name
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {filtered.map((g) => {
              const isBlacklisted = blacklist.includes(g.guild_id);
              return (
                <div
                  key={g.guild_id}
                  className="flex items-center gap-4 rounded-lg border border-border/60 bg-background-elevated/40 p-3"
                >
                  <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-chart-4 to-primary text-sm font-semibold text-primary-foreground">
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
                    <div className="truncate font-medium text-foreground">
                      {g.guild_name || 'Unnamed server'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Joined {relativeTime(g.joined_at)} ·{' '}
                      {g.reconnect_count} reconnect(s)
                    </div>
                  </div>
                  {isBlacklisted ? (
                    <Badge
                      variant="outline"
                      className="border-destructive/30 bg-destructive/10 text-destructive"
                    >
                      <Ban className="mr-1 h-3 w-3" />
                      Blacklisted
                    </Badge>
                  ) : (
                    <>
                      {g.target_voice_channel_id && (
                        <Badge
                          variant="outline"
                          className="border-success/30 bg-success/10 text-success"
                        >
                          24/7 active
                        </Badge>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/dashboard/${g.guild_id}`)}
                        className="gap-1.5"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        View
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => blacklistGuild(g.guild_id, g.guild_name || 'Unknown')}
                        className="gap-1.5 text-destructive hover:bg-destructive/10"
                      >
                        <Ban className="h-3.5 w-3.5" />
                        Blacklist
                      </Button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
