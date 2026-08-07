'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  Info,
  Radio,
  Settings,
  Trash2,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useNotifications } from '@/components/providers/notification-provider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { NotificationCategory, NotificationSeverity } from '@/types';
import { relativeTime } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

const SEVERITY_META: Record<
  NotificationSeverity,
  { icon: LucideIcon; color: string; bg: string }
> = {
  info: { icon: Info, color: 'text-primary', bg: 'bg-primary/10' },
  success: { icon: CheckCheck, color: 'text-success', bg: 'bg-success/10' },
  warning: { icon: AlertTriangle, color: 'text-warning', bg: 'bg-warning/10' },
  error: { icon: AlertTriangle, color: 'text-destructive', bg: 'bg-destructive/10' },
};

const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  general: 'General',
  voice: 'Voice',
  streamer: 'Streamer',
  game: 'Game',
  system: 'System',
  security: 'Security',
  user: 'User',
  announcement: 'Announcement',
  audit: 'Audit',
};

const ALL_CHANNELS: NotificationCategory[] = [
  'voice',
  'streamer',
  'game',
  'system',
  'security',
  'announcement',
];

export function NotificationCentre() {
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead, dismiss } =
    useNotifications();
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [prefs, setPrefs] = useState<{
    email: boolean;
    in_app: boolean;
    webhook: boolean;
    webhook_url: string;
    channels: Record<string, boolean>;
  } | null>(null);

  const loadPrefs = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('app_settings')
      .select('notification_prefs')
      .eq('user_id', user.id)
      .maybeSingle();
    if (data?.notification_prefs) {
      setPrefs(data.notification_prefs as typeof prefs);
    }
  };

  const savePref = async (key: string, value: unknown) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || !prefs) return;
    const updated = { ...prefs, [key]: value };
    setPrefs(updated);
    await supabase
      .from('app_settings')
      .update({ notification_prefs: updated, updated_at: new Date().toISOString() })
      .eq('user_id', user.id);
    toast.success('Notification preference saved');
  };

  const saveChannelPref = async (channel: string, value: boolean) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || !prefs) return;
    const updated = {
      ...prefs,
      channels: { ...prefs.channels, [channel]: value },
    };
    setPrefs(updated);
    await supabase
      .from('app_settings')
      .update({ notification_prefs: updated, updated_at: new Date().toISOString() })
      .eq('user_id', user.id);
  };

  return (
    <div className="flex items-center gap-1">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="relative h-9 w-9"
            title="Notifications"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="w-96 p-0"
          sideOffset={8}
        >
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">
                Notifications
              </span>
              {unreadCount > 0 && (
                <Badge variant="outline" className="text-xs text-primary">
                  {unreadCount} unread
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={markAllAsRead}
                disabled={unreadCount === 0}
                title="Mark all as read"
              >
                <CheckCheck className="h-3.5 w-3.5" />
              </Button>
              <Dialog
                open={prefsOpen}
                onOpenChange={(o) => {
                  setPrefsOpen(o);
                  if (o) loadPrefs();
                }}
              >
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    title="Notification preferences"
                  >
                    <Settings className="h-3.5 w-3.5" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Notification preferences</DialogTitle>
                  </DialogHeader>
                  {prefs && (
                    <div className="space-y-5 py-2">
                      <div className="space-y-3">
                        <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                          Delivery channels
                        </Label>
                        {[
                          { key: 'in_app', label: 'In-app notifications' },
                          { key: 'email', label: 'Email notifications' },
                          { key: 'webhook', label: 'Webhook (POST to URL)' },
                        ].map((row) => (
                          <div
                            key={row.key}
                            className="flex items-center justify-between rounded-lg border border-border/60 bg-background-elevated/40 p-3"
                          >
                            <Label htmlFor={row.key} className="text-sm font-normal">
                              {row.label}
                            </Label>
                            <Switch
                              id={row.key}
                              checked={prefs[row.key as keyof typeof prefs] as boolean}
                              onCheckedChange={(v) => savePref(row.key, v)}
                            />
                          </div>
                        ))}
                        {prefs.webhook && (
                          <Input
                            placeholder="https://example.com/webhook"
                            value={prefs.webhook_url}
                            onChange={(e) => savePref('webhook_url', e.target.value)}
                          />
                        )}
                      </div>
                      <div className="space-y-3">
                        <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                          Alert categories
                        </Label>
                        {ALL_CHANNELS.map((ch) => (
                          <div
                            key={ch}
                            className="flex items-center justify-between rounded-lg border border-border/60 bg-background-elevated/40 p-3"
                          >
                            <Label
                              htmlFor={`ch-${ch}`}
                              className="text-sm font-normal"
                            >
                              {CATEGORY_LABELS[ch]}
                            </Label>
                            <Switch
                              id={`ch-${ch}`}
                              checked={prefs.channels?.[ch] ?? true}
                              onCheckedChange={(v) => saveChannelPref(ch, v)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <ScrollArea className="h-80">
            {loading ? (
              <div className="space-y-2 p-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
                <Bell className="h-6 w-6" />
                <span className="text-sm">No notifications yet.</span>
              </div>
            ) : (
              <div className="space-y-1 p-2">
                {notifications.map((n) => {
                  const meta = SEVERITY_META[n.severity];
                  const Icon = meta.icon;
                  return (
                    <div
                      key={n.id}
                      className={cn(
                        'group relative flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-accent/10',
                        !n.read && 'bg-primary/5'
                      )}
                    >
                      <div
                        className={cn(
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                          meta.bg
                        )}
                      >
                        <Icon className={cn('h-4 w-4', meta.color)} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium text-foreground">
                            {n.title}
                          </span>
                          {!n.read && (
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                          )}
                        </div>
                        {n.body && (
                          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                            {n.body}
                          </p>
                        )}
                        <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                          <span className="capitalize">{CATEGORY_LABELS[n.category]}</span>
                          <span>·</span>
                          <span>{relativeTime(n.created_at)}</span>
                          {n.action_label && n.action_url && (
                            <>
                              <span>·</span>
                              <a
                                href={n.action_url}
                                className="font-medium text-primary hover:underline"
                              >
                                {n.action_label}
                              </a>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                        {!n.read && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => markAsRead(n.id)}
                            title="Mark as read"
                          >
                            <CheckCheck className="h-3 w-3" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          onClick={() => dismiss(n.id)}
                          title="Dismiss"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>
    </div>
  );
}
