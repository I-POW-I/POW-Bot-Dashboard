'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Activity, Filter, Search } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { fetchAuditLog, relativeTime } from '@/lib/data';
import type { AuditCategory, AuditLogEntry } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AuditFeed } from '@/components/dashboard/audit-feed';

const CATEGORIES: { value: AuditCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All categories' },
  { value: 'voice', label: 'Voice' },
  { value: 'logging', label: 'Logging' },
  { value: 'streamers', label: 'Streamers' },
  { value: 'verification', label: 'Verification' },
  { value: 'welcome', label: 'Welcome' },
  { value: 'system', label: 'System' },
];

export default function AuditPage() {
  const params = useParams<{ guildId: string }>();
  const { user } = useAuth();
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<AuditCategory | 'all'>('all');

  useEffect(() => {
    if (!user || !params?.guildId) return;
    (async () => {
      const e = await fetchAuditLog(params.guildId, 200);
      setEntries(e);
      setLoading(false);
    })();
  }, [user, params?.guildId]);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (category !== 'all' && e.category !== category) return false;
      if (query) {
        const q = query.toLowerCase();
        return (
          e.action.toLowerCase().includes(q) ||
          (e.actor_username || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [entries, query, category]);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Activity className="h-6 w-6 animate-pulse text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Audit Log
        </h2>
        <p className="text-sm text-muted-foreground">
          Every action taken via the dashboard, in order.
        </p>
      </div>

      <Card className="glass">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 items-center gap-2">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search actions or users…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select
                value={category}
                onValueChange={(v) => setCategory(v as AuditCategory | 'all')}
              >
                <SelectTrigger className="w-48">
                  <Filter className="mr-2 h-3.5 w-3.5" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Badge variant="outline" className="text-muted-foreground">
              {filtered.length} of {entries.length} entries
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              No matching entries.
            </div>
          ) : (
            <div className="space-y-1">
              {filtered.map((e) => {
                const meta = {
                  icon: Activity,
                  color: 'text-primary bg-primary/10',
                };
                return (
                  <div
                    key={e.id}
                    className="flex items-start gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-accent/10"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground">{e.action}</p>
                      <p className="text-xs text-muted-foreground">
                        {e.actor_username || 'system'} ·{' '}
                        {relativeTime(e.created_at)} · {e.category}
                      </p>
                    </div>
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
