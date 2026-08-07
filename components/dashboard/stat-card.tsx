'use client';

import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';

interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  hint?: string;
  trend?: { value: string; positive: boolean };
  accent?: 'primary' | 'success' | 'warning' | 'chart4' | 'chart3';
}

const ACCENTS: Record<NonNullable<StatCardProps['accent']>, string> = {
  primary: 'text-primary bg-primary/10',
  success: 'text-success bg-success/10',
  warning: 'text-warning bg-warning/10',
  chart4: 'text-chart-4 bg-chart-4/10',
  chart3: 'text-chart-3 bg-chart-3/10',
};

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  trend,
  accent = 'primary',
}: StatCardProps) {
  return (
    <Card className="glass relative overflow-hidden p-5">
      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br from-primary/5 to-transparent blur-2xl" />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
          {hint && (
            <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
          )}
          {trend && (
            <p
              className={cn(
                'mt-2 text-xs font-medium',
                trend.positive ? 'text-success' : 'text-destructive'
              )}
            >
              {trend.positive ? '↑' : '↓'} {trend.value}
            </p>
          )}
        </div>
        <div
          className={cn(
            'flex h-11 w-11 items-center justify-center rounded-xl',
            ACCENTS[accent]
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}
