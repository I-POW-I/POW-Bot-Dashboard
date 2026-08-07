'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Bot,
  Clock,
  Radio,
  Server,
  Users,
  Volume2,
  Zap,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAuth } from '@/components/providers/auth-provider';
import { fetchBotStatus, fetchVcSessions, relativeTime } from '@/lib/data';
import type { BotStatus, VcSession } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

type Range = 7 | 30 | 90;

const CHART_COLORS = [
  'hsl(199 89% 52%)',
  'hsl(142 71% 45%)',
  'hsl(38 92% 50%)',
  'hsl(280 65% 65%)',
  'hsl(340 75% 60%)',
];

function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border/60 bg-popover/95 px-3 py-2 shadow-lg backdrop-blur">
      {label && <p className="mb-1 text-xs font-medium text-foreground">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="text-xs text-muted-foreground" style={{ color: p.color }}>
          {p.name}: <span className="font-semibold">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [allSessions, setAllSessions] = useState<VcSession[]>([]);
  const [range, setRange] = useState<Range>(30);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.replace('/');
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [s, ...sessionSets] = await Promise.all([
        fetchBotStatus(),
        ...user.guilds.map((g) => fetchVcSessions(g.guildId, 2000)),
      ]);
      setStatus(s);
      setAllSessions(sessionSets.flat());
      setDataLoading(false);
    })();
  }, [user]);

  const cutoff = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - range);
    return d.getTime();
  }, [range]);

  const sessions = useMemo(
    () => allSessions.filter((s) => new Date(s.joined_at).getTime() >= cutoff),
    [allSessions, cutoff]
  );

  const activityByDay = useMemo(() => {
    const map = new Map<string, { date: string; sessions: number; minutes: number }>();
    for (const s of sessions) {
      const d = new Date(s.joined_at);
      const key = d.toISOString().slice(0, 10);
      const entry = map.get(key) || { date: key, sessions: 0, minutes: 0 };
      entry.sessions += 1;
      entry.minutes += Math.round((s.duration_ms || 0) / 60000);
      map.set(key, entry);
    }
    const arr = Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
    return arr.map((d) => ({
      ...d,
      label: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    }));
  }, [sessions]);

  const roleBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of sessions) {
      const key = s.channel_name || 'Unknown';
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [sessions]);

  const systemLoad = useMemo(() => {
    const buckets = 12;
    const now = Date.now();
    const span = range * 86400000;
    const step = span / buckets;
    return Array.from({ length: buckets }, (_, i) => {
      const start = now - span + i * step;
      const end = start + step;
      const count = sessions.filter((s) => {
        const t = new Date(s.joined_at).getTime();
        return t >= start && t < end;
      }).length;
      return {
        label: new Date(start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        load: count,
        capacity: 100,
      };
    });
  }, [sessions, range]);

  const kpis = useMemo(() => {
    const totalSessions = sessions.length;
    const totalMinutes = sessions.reduce((sum, s) => sum + (s.duration_ms || 0) / 60000, 0);
    const uniqueUsers = new Set(sessions.map((s) => s.user_discord_id)).size;
    const avgDuration = totalSessions > 0 ? totalMinutes / totalSessions : 0;

    const prevCutoff = cutoff - range * 86400000;
    const prevSessions = allSessions.filter((s) => {
      const t = new Date(s.joined_at).getTime();
      return t >= prevCutoff && t < cutoff;
    });
    const prevTotal = prevSessions.length;
    const prevUsers = new Set(prevSessions.map((s) => s.user_discord_id)).size;
    const prevMinutes = prevSessions.reduce((sum, s) => sum + (s.duration_ms || 0) / 60000, 0);

    const sessionTrend = prevTotal > 0 ? ((totalSessions - prevTotal) / prevTotal) * 100 : 0;
    const userTrend = prevUsers > 0 ? ((uniqueUsers - prevUsers) / prevUsers) * 100 : 0;
    const minuteTrend = prevMinutes > 0 ? ((totalMinutes - prevMinutes) / prevMinutes) * 100 : 0;
    const avgTrend = prevTotal > 0 && prevSessions.length > 0
      ? ((avgDuration - prevMinutes / prevSessions.length) / (prevMinutes / prevSessions.length)) * 100
      : 0;

    return {
      totalSessions,
      totalMinutes: Math.round(totalMinutes),
      uniqueUsers,
      avgDuration: Math.round(avgDuration),
      sessionTrend,
      userTrend,
      minuteTrend,
      avgTrend,
    };
  }, [sessions, allSessions, cutoff, range]);

  if (loading || !user || dataLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Bot className="h-5 w-5 animate-pulse text-primary" />
          <span>Loading analytics…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="pointer-events-none fixed inset-0 bg-grid opacity-20" />
      <div className="pointer-events-none fixed inset-0 bg-radial-glow" />
      <div className="relative mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Analytics
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Cross-server activity, engagement, and system health.
            </p>
          </div>
          <Tabs value={String(range)} onValueChange={(v) => setRange(Number(v) as Range)}>
            <TabsList>
              <TabsTrigger value="7">7 days</TabsTrigger>
              <TabsTrigger value="30">30 days</TabsTrigger>
              <TabsTrigger value="90">90 days</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* KPI cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            icon={Activity}
            label="Total sessions"
            value={kpis.totalSessions.toLocaleString()}
            trend={kpis.sessionTrend}
            accent="primary"
          />
          <KpiCard
            icon={Users}
            label="Unique members"
            value={kpis.uniqueUsers.toLocaleString()}
            trend={kpis.userTrend}
            accent="chart4"
          />
          <KpiCard
            icon={Clock}
            label="Total minutes"
            value={kpis.totalMinutes.toLocaleString()}
            trend={kpis.minuteTrend}
            accent="chart3"
          />
          <KpiCard
            icon={Volume2}
            label="Avg duration"
            value={`${kpis.avgDuration}m`}
            trend={kpis.avgTrend}
            accent="success"
          />
        </div>

        {/* Activity line chart */}
        <Card className="glass mt-6">
          <CardHeader>
            <CardTitle className="text-base">Voice activity over time</CardTitle>
            <CardDescription>Sessions and minutes per day · last {range} days</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={activityByDay} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 25% 16%)" />
                <XAxis dataKey="label" stroke="hsl(215 20% 65%)" fontSize={11} tickLine={false} />
                <YAxis stroke="hsl(215 20% 65%)" fontSize={11} tickLine={false} />
                <RTooltip content={<ChartTooltip />} />
                <Line type="monotone" dataKey="sessions" stroke={CHART_COLORS[0]} strokeWidth={2} dot={false} name="Sessions" />
                <Line type="monotone" dataKey="minutes" stroke={CHART_COLORS[1]} strokeWidth={2} dot={false} name="Minutes" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Bar chart + Pie chart */}
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-base">Sessions by channel</CardTitle>
              <CardDescription>Top channels in the selected range</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={roleBreakdown} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 25% 16%)" />
                  <XAxis type="number" stroke="hsl(215 20% 65%)" fontSize={11} tickLine={false} />
                  <YAxis type="category" dataKey="name" stroke="hsl(215 20% 65%)" fontSize={11} tickLine={false} width={100} />
                  <RTooltip content={<ChartTooltip />} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {roleBreakdown.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-base">Channel distribution</CardTitle>
              <CardDescription>Share of sessions by channel</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={roleBreakdown}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                  >
                    {roleBreakdown.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <RTooltip content={<ChartTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: 11, color: 'hsl(215 20% 65%)' }}
                    iconType="circle"
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* System load area chart */}
        <Card className="glass mt-6">
          <CardHeader>
            <CardTitle className="text-base">System load</CardTitle>
            <CardDescription>Session volume distribution across the range</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={systemLoad} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <defs>
                  <linearGradient id="loadGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_COLORS[0]} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={CHART_COLORS[0]} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 25% 16%)" />
                <XAxis dataKey="label" stroke="hsl(215 20% 65%)" fontSize={11} tickLine={false} />
                <YAxis stroke="hsl(215 20% 65%)" fontSize={11} tickLine={false} />
                <RTooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="load" stroke={CHART_COLORS[0]} fill="url(#loadGrad)" strokeWidth={2} name="Load" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Bot status summary */}
        <Card className="glass mt-6">
          <CardHeader>
            <CardTitle className="text-base">Bot health</CardTitle>
            <CardDescription>Live runtime snapshot</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Metric icon={Server} label="Servers" value={status?.total_guilds ?? '—'} />
              <Metric icon={Users} label="Members" value={(status?.total_members ?? 0).toLocaleString()} />
              <Metric icon={Zap} label="Ping" value={`${status?.ping_ms ?? '—'}ms`} />
              <Metric icon={Radio} label="Presence" value={status?.presence_activity || '—'} />
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Last updated {relativeTime(status?.updated_at)}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  trend,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  trend: number;
  accent: 'primary' | 'success' | 'chart4' | 'chart3';
}) {
  const accents: Record<string, string> = {
    primary: 'text-primary bg-primary/10',
    success: 'text-success bg-success/10',
    chart4: 'text-chart-4 bg-chart-4/10',
    chart3: 'text-chart-3 bg-chart-3/10',
  };
  const positive = trend >= 0;
  return (
    <Card className="glass relative overflow-hidden p-5">
      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br from-primary/5 to-transparent blur-2xl" />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
          <p
            className={cn(
              'mt-2 flex items-center gap-1 text-xs font-medium',
              positive ? 'text-success' : 'text-destructive'
            )}
          >
            {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(trend).toFixed(1)}% vs previous
          </p>
        </div>
        <div className={cn('flex h-11 w-11 items-center justify-center rounded-xl', accents[accent])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-background-elevated/40 p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-1 text-lg font-semibold text-foreground">{value}</div>
    </div>
  );
}
