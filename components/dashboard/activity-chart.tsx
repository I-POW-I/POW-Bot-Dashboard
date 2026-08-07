'use client';

import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { VcSession } from '@/types';

interface ActivityChartProps {
  sessions: VcSession[];
}

export function ActivityChart({ sessions }: ActivityChartProps) {
  const data = useMemo(() => {
    const byDay = new Map<string, { date: string; count: number; minutes: number }>();
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = d.toISOString().split('T')[0];
      byDay.set(key, { date: key, count: 0, minutes: 0 });
    }
    for (const s of sessions) {
      const key = new Date(s.joined_at).toISOString().split('T')[0];
      const entry = byDay.get(key);
      if (entry) {
        entry.count += 1;
        entry.minutes += Math.round((s.duration_ms || 0) / 60000);
      }
    }
    return Array.from(byDay.values()).map((d) => ({
      ...d,
      label: new Date(d.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
    }));
  }, [sessions]);

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 12, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="activityFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(var(--border))"
            strokeOpacity={0.4}
            vertical={false}
          />
          <XAxis
            dataKey="label"
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            interval={4}
          />
          <YAxis
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '0.5rem',
              fontSize: '12px',
              color: 'hsl(var(--foreground))',
            }}
            labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
            formatter={(value: number, name: string) => {
              if (name === 'count') return [`${value} sessions`, 'Sessions'];
              return [`${value} min`, 'Voice time'];
            }}
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            fill="url(#activityFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
