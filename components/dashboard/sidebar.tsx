'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  BarChart3,
  Bot,
  ChevronLeft,
  Clock,
  LayoutDashboard,
  LogOut,
  Radio,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Tags,
  Terminal,
  Users,
  Volume2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface NavItem {
  href: (guildId: string) => string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
  feature?: string;
}

const GUILD_NAV_ITEMS: NavItem[] = [
  { href: (g) => `/dashboard/${g}`, label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: (g) => `/dashboard/${g}/voice`, label: '24/7 Voice', icon: Volume2, feature: 'voice' },
  { href: (g) => `/dashboard/${g}/automod`, label: 'Auto-Moderation', icon: ShieldAlert, feature: 'automod' },
  { href: (g) => `/dashboard/${g}/commands`, label: 'Custom Commands', icon: Terminal, feature: 'commands' },
  { href: (g) => `/dashboard/${g}/reaction-roles`, label: 'Reaction Roles', icon: Tags, feature: 'reaction-roles' },
  { href: (g) => `/dashboard/${g}/logging`, label: 'Log Channels', icon: Activity, feature: 'logging' },
  { href: (g) => `/dashboard/${g}/welcome`, label: 'Welcome & Verify', icon: ShieldCheck, feature: 'welcome' },
  { href: (g) => `/dashboard/${g}/streamers`, label: 'Streamer Alerts', icon: Radio, feature: 'streamers' },
  { href: (g) => `/dashboard/${g}/games`, label: 'Game Alerts', icon: Sparkles, feature: 'games' },
  { href: (g) => `/dashboard/${g}/leaderboard`, label: 'VC Leaderboard', icon: Clock, feature: 'leaderboard' },
  { href: (g) => `/dashboard/${g}/audit`, label: 'Audit Log', icon: Settings, feature: 'audit' },
];

const GLOBAL_NAV_ITEMS: NavItem[] = [
  { href: () => `/analytics`, label: 'Analytics', icon: BarChart3, exact: true },
  { href: () => `/users`, label: 'User Management', icon: Users, feature: 'users' },
  { href: () => `/settings`, label: 'Settings', icon: Settings, feature: 'settings' },
];

export function Sidebar({
  guildId,
  guildName,
  guildIcon,
  collapsed,
  onToggleCollapse,
}: {
  guildId: string;
  guildName: string;
  guildIcon: string | null;
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  const renderLink = (item: NavItem, isGuild: boolean) => {
    const href = item.href(guildId);
    const active = item.exact
      ? pathname === href
      : pathname?.startsWith(href);
    const link = (
      <Link
        key={href}
        href={href}
        className={cn(
          'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
          collapsed && 'justify-center px-0',
          active
            ? 'bg-primary/10 text-primary shadow-sm'
            : 'text-muted-foreground hover:bg-accent/10 hover:text-foreground'
        )}
      >
        <item.icon
          className={cn(
            'h-4 w-4 shrink-0 transition-transform group-hover:scale-110',
            active ? 'text-primary' : ''
          )}
        />
        {!collapsed && <span>{item.label}</span>}
        {!collapsed && active && (
          <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
        )}
      </Link>
    );
    if (collapsed) {
      return (
        <Tooltip key={href}>
          <TooltipTrigger asChild>{link}</TooltipTrigger>
          <TooltipContent side="right">{item.label}</TooltipContent>
        </Tooltip>
      );
    }
    return link;
  };

  return (
    <aside
      className={cn(
        'flex h-full shrink-0 flex-col border-r border-border/60 bg-card/40 backdrop-blur-xl transition-all',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      <div className={cn('flex h-16 items-center gap-3 border-b border-border/60', collapsed ? 'justify-center px-0' : 'px-5')}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-chart-4 shadow-md shadow-primary/20">
          <Bot className="h-5 w-5 text-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="flex flex-1 flex-col leading-tight">
            <span className="text-sm font-semibold text-foreground">POW Bot</span>
            <span className="text-xs text-muted-foreground">Control Panel</span>
          </div>
        )}
        {!collapsed && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground"
            onClick={onToggleCollapse}
            title="Collapse sidebar"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
      </div>

      {collapsed && (
        <div className="flex justify-center pt-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground"
            onClick={onToggleCollapse}
            title="Expand sidebar"
          >
            <ChevronLeft className="h-4 w-4 rotate-180" />
          </Button>
        </div>
      )}

      {!collapsed && (
        <div className="px-3 py-4">
          <Link
            href="/dashboard"
            className="group flex items-center gap-3 rounded-lg border border-border/60 bg-background-elevated/50 p-3 transition-colors hover:border-primary/40"
          >
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-chart-4 to-primary text-sm font-semibold text-primary-foreground">
              {guildIcon ? (
                <img
                  src={`https://cdn.discordapp.com/icons/${guildId}/${guildIcon}.png`}
                  alt={guildName}
                  className="h-full w-full object-cover"
                />
              ) : (
                guildName?.[0]?.toUpperCase() || 'G'
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-foreground">
                {guildName}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                Switch server
              </div>
            </div>
            <ChevronLeft className="h-4 w-4 rotate-180 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      )}

      <ScrollArea className="flex-1 px-3">
        <nav className="space-y-1 pb-4">
          {!collapsed && (
            <div className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {guildName?.split(' ')[0] || 'Server'}
            </div>
          )}
          {GUILD_NAV_ITEMS.map((item) => renderLink(item, true))}

          {!collapsed && (
            <div className="px-3 pb-1 pt-5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Organization
            </div>
          )}
          {collapsed && <div className="my-3 border-t border-border/40" />}
          {GLOBAL_NAV_ITEMS.map((item) => renderLink(item, false))}
        </nav>
      </ScrollArea>

      <div className="border-t border-border/60 p-3">
        {user?.globalRole === 'owner' && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/owner"
                className={cn(
                  'mb-2 flex items-center gap-3 rounded-lg border border-chart-4/30 bg-chart-4/5 px-3 py-2.5 text-sm font-medium text-chart-4 transition-colors hover:bg-chart-4/10',
                  collapsed && 'justify-center px-0'
                )}
              >
                <Sparkles className="h-4 w-4 shrink-0" />
                {!collapsed && 'Owner Panel'}
                {!collapsed && (
                  <Badge
                    variant="outline"
                    className="ml-auto border-chart-4/30 bg-chart-4/10 text-chart-4"
                  >
                    GOD
                  </Badge>
                )}
              </Link>
            </TooltipTrigger>
            {collapsed && (
              <TooltipContent side="right">Owner Panel</TooltipContent>
            )}
          </Tooltip>
        )}
        <div className={cn('flex items-center gap-3 rounded-lg p-2', collapsed && 'justify-center')}>
          <Avatar className="h-9 w-9 border border-border/60">
            <AvatarImage src={user?.avatarUrl || undefined} alt={user?.username} />
            <AvatarFallback>
              {user?.username?.[0]?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-foreground">
                {user?.globalName || user?.username || 'User'}
              </div>
              <div className="truncate text-xs capitalize text-muted-foreground">
                {user?.appRole?.replace('_', ' ') || 'viewer'}
              </div>
            </div>
          )}
          {!collapsed && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => signOut()}
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </aside>
  );
}
