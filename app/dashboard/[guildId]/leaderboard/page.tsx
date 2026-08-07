'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Award, Clock, Flame, Trophy, Users } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { fetchVcSessions, formatMs } from '@/lib/data';
import type { VcSession } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface UserStats {
  user_discord_id: string;
  username: string;
  avatar_url: string | null;
  total_ms: number;
  sessions: number;
  last_seen: string | null;
}

export default function LeaderboardPage() {
  const params = useParams<{ guildId: string }>();
  const { user } = useAuth();
  const [sessions, setSessions] = useState<VcSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !params?.guildId) return;
    (async () => {
      const s = await fetchVcSessions(params.guildId, 2000);
      setSessions(s);
      setLoading(false);
    })();
  }, [user, params?.guildId]);

  const leaderboard = useMemo<UserStats[]>(() => {
    const byUser = new Map<string, UserStats>();
    for (const s of sessions) {
      const id = s.user_discord_id;
      const existing = byUser.get(id) || {
        user_discord_id: id,
        username: s.username || 'Unknown',
        avatar_url: s.avatar_url,
        total_ms: 0,
        sessions: 0,
        last_seen: null,
      };
      existing.total_ms += s.duration_ms || 0;
      existing.sessions += 1;
      const joined = new Date(s.joined_at).getTime();
      if (!existing.last_seen || joined > new Date(existing.last_seen).getTime()) {
        existing.last_seen = s.joined_at;
      }
      byUser.set(id, existing);
    }
    return Array.from(byUser.values()).sort((a, b) => b.total_ms - a.total_ms);
  }, [sessions]);

  const totals = useMemo(() => {
    const totalMs = leaderboard.reduce((sum, u) => sum + u.total_ms, 0);
    const totalSessions = leaderboard.reduce((sum, u) => sum + u.sessions, 0);
    return { totalMs, totalSessions, uniqueUsers: leaderboard.length };
  }, [leaderboard]);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Trophy className="h-6 w-6 animate-pulse text-primary" />
      </div>
    );
  }

  const podium = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          VC Leaderboard
        </h2>
        <p className="text-sm text-muted-foreground">
          Who actually shows up. Tracked from the bot's vc_sessions table.
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="glass p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Unique members</div>
              <div className="text-xl font-bold text-foreground">
                {totals.uniqueUsers}
              </div>
            </div>
          </div>
        </Card>
        <Card className="glass p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-chart-4/10 text-chart-4">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Total VC time</div>
              <div className="text-xl font-bold text-foreground">
                {formatMs(totals.totalMs)}
              </div>
            </div>
          </div>
        </Card>
        <Card className="glass p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-chart-3/10 text-chart-3">
              <Award className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Total sessions</div>
              <div className="text-xl font-bold text-foreground">
                {totals.totalSessions}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Podium */}
      {podium.length >= 3 && (
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 0, 2].map((idx) => {
            const u = podium[idx];
            const place = idx + 1;
            const heights = ['h-32', 'h-40', 'h-28'];
            const colors = [
              'from-chart-3 to-warning',
              'from-primary to-chart-4',
              'from-chart-2 to-success',
            ];
            const medals = ['🥇', '🥈', '🥉'];
            return (
              <Card
                key={u.user_discord_id}
                className={cn(
                  'glass relative flex flex-col items-center p-6 text-center',
                  place === 1 && 'md:-translate-y-4 md:scale-105'
                )}
              >
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-3xl">
                  {medals[idx]}
                </div>
                <Avatar className="h-16 w-16 border-2 border-border">
                  <AvatarImage src={u.avatar_url || undefined} />
                  <AvatarFallback className="bg-gradient-to-br from-primary to-chart-4 text-primary-foreground">
                    {u.username[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="mt-3 font-semibold text-foreground">
                  {u.username}
                </div>
                <div className="text-xs text-muted-foreground">
                  {u.sessions} sessions
                </div>
                <div
                  className={cn(
                    'mt-4 w-full rounded-lg bg-gradient-to-br text-center',
                    colors[idx],
                    heights[idx]
                  )}
                >
                  <div className="flex h-full flex-col items-center justify-center text-primary-foreground">
                    <div className="text-2xl font-bold">
                      {formatMs(u.total_ms)}
                    </div>
                    <div className="text-xs opacity-80">total time</div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Full table */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-base">All members</CardTitle>
          <CardDescription>Ranked by total voice time</CardDescription>
        </CardHeader>
        <CardContent>
          {leaderboard.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
              No VC activity tracked yet.
            </div>
          ) : (
            <div className="space-y-2">
              {leaderboard.map((u, i) => (
                <div
                  key={u.user_discord_id}
                  className="flex items-center gap-4 rounded-lg border border-border/60 bg-background-elevated/40 p-3 transition-colors hover:border-primary/30"
                >
                  <div
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-sm font-semibold',
                      i === 0
                        ? 'bg-warning/15 text-warning'
                        : i === 1
                        ? 'bg-muted text-muted-foreground'
                        : i === 2
                        ? 'bg-chart-3/15 text-chart-3'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {i + 1}
                  </div>
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={u.avatar_url || undefined} />
                    <AvatarFallback>{u.username[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-foreground">
                      {u.username}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {u.sessions} sessions · last seen{' '}
                      {u.last_seen
                        ? new Date(u.last_seen).toLocaleDateString()
                        : '—'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-foreground">
                      {formatMs(u.total_ms)}
                    </div>
                    {i < 3 && (
                      <Badge variant="outline" className="mt-0.5 text-xs text-muted-foreground">
                        <Flame className="mr-1 h-3 w-3" />
                        Top {i + 1}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
