'use client';

import { useEffect, useState } from 'react';
import { Ban, Search, UserX, Users } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { fetchVcSessions, insertAuditLog, formatMs } from '@/lib/data';
import type { VcSession } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';

interface UserRow {
  user_discord_id: string;
  username: string;
  avatar_url: string | null;
  total_ms: number;
  sessions: number;
  guilds: Set<string>;
}

export default function OwnerUsersPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [query, setQuery] = useState('');
  const [blacklist, setBlacklist] = useState<string[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const allSessions: VcSession[] = [];
      for (const g of user.guilds) {
        const s = await fetchVcSessions(g.guildId, 2000);
        allSessions.push(...s);
      }
      const byUser = new Map<string, UserRow>();
      for (const s of allSessions) {
        const id = s.user_discord_id;
        const existing = byUser.get(id) || {
          user_discord_id: id,
          username: s.username || 'Unknown',
          avatar_url: s.avatar_url,
          total_ms: 0,
          sessions: 0,
          guilds: new Set<string>(),
        };
        existing.total_ms += s.duration_ms || 0;
        existing.sessions += 1;
        existing.guilds.add(s.guild_id);
        byUser.set(id, existing);
      }
      setRows(Array.from(byUser.values()).sort((a, b) => b.total_ms - a.total_ms));
      const { data } = await supabase.from('blacklist').select('target_id').eq('target_type', 'user');
      setBlacklist((data || []).map((d: { target_id: string }) => d.target_id));
    })();
  }, [user]);

  const filtered = rows.filter((r) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      r.username.toLowerCase().includes(q) ||
      r.user_discord_id.includes(q)
    );
  });

  const blacklistUser = async (uid: string, name: string) => {
    const { error } = await supabase
      .from('blacklist')
      .insert({ target_type: 'user', target_id: uid, reason: 'Owner blacklist' });
    if (error && error.code !== '23505') {
      toast({ title: 'Failed', description: error.message, variant: 'destructive' });
      return;
    }
    setBlacklist([...blacklist, uid]);
    if (user) {
      await insertAuditLog({
        guild_id: 'global',
        actor_discord_id: user.discordId,
        actor_username: user.username,
        action: `Blacklisted user ${name} globally`,
        category: 'blacklist',
        details: { userId: uid, name },
      });
    }
    toast({ title: 'User blacklisted globally', description: name });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          User Management
        </h1>
        <p className="text-sm text-muted-foreground">
          Search any Discord user the bot has seen, view their stats, or
          blacklist them globally.
        </p>
      </div>

      <Card className="glass">
        <CardHeader>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by username or Discord ID…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              <UserX className="mr-2 h-5 w-5" /> No users found.
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.slice(0, 100).map((r) => {
                const isBlacklisted = blacklist.includes(r.user_discord_id);
                return (
                  <div
                    key={r.user_discord_id}
                    className="flex items-center gap-4 rounded-lg border border-border/60 bg-background-elevated/40 p-3"
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={r.avatar_url || undefined} />
                      <AvatarFallback>
                        {r.username[0]?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-foreground">
                        {r.username}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        ID: {r.user_discord_id} · {r.guilds.size} server(s)
                      </div>
                    </div>
                    <div className="hidden text-right sm:block">
                      <div className="text-sm font-semibold text-foreground">
                        {formatMs(r.total_ms)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {r.sessions} sessions
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
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => blacklistUser(r.user_discord_id, r.username)}
                        className="gap-1.5 text-destructive hover:bg-destructive/10"
                      >
                        <Ban className="h-3.5 w-3.5" />
                        Blacklist
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
