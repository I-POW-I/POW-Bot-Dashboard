'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { Sidebar } from '@/components/dashboard/sidebar';
import { Navbar } from '@/components/dashboard/navbar';
import { fetchGuildConfig } from '@/lib/data';
import type { GuildConfig } from '@/types';
import { Bot } from 'lucide-react';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';

export default function GuildLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams<{ guildId: string }>();
  const router = useRouter();
  const { user, loading } = useAuth();
  const [config, setConfig] = useState<GuildConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/');
  }, [user, loading, router]);

  const [membershipChecked, setMembershipChecked] = useState(false);

  useEffect(() => {
    if (!user || !params?.guildId) return;
    setConfigLoading(true);
    setMembershipChecked(false);

    const membership = user.guilds.find((g) => g.guildId === params.guildId);
    if (!membership) {
      router.replace('/dashboard');
      return;
    }
    setMembershipChecked(true);

    let cancelled = false;
    (async () => {
      const c = await fetchGuildConfig(params.guildId);
      // Guards against a slow fetch for a guild the user has already
      // navigated away from resolving AFTER a newer one — without this,
      // switching guilds quickly could show the wrong guild's config.
      if (cancelled) return;
      setConfig(c);
      setConfigLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [user, params?.guildId, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Bot className="h-5 w-5 animate-pulse text-primary" />
          <span>Loading dashboard…</span>
        </div>
      </div>
    );
  }

  // Previously this checked `user.guilds.find(...)` directly at render time
  // and returned `null` (a blank screen) whenever it didn't match — including
  // transiently during route changes, which is exactly what was causing
  // "click back / navigate and the page goes blank". Now we only trust the
  // membership check once the effect above has actually confirmed it, and
  // show a loading state in between rather than nothing.
  if (!membershipChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Bot className="h-5 w-5 animate-pulse text-primary" />
          <span>Loading server…</span>
        </div>
      </div>
    );
  }

  return (
    <ResizablePanelGroup direction="horizontal" className="h-screen overflow-hidden bg-background">
      <ResizablePanel
        defaultSize={collapsed ? 4 : 18}
        minSize={4}
        maxSize={28}
        collapsible
        collapsedSize={4}
        onCollapse={() => setCollapsed(true)}
        onExpand={() => setCollapsed(false)}
        className="min-w-[4rem]"
      >
        <Sidebar
          guildId={params!.guildId}
          guildName={config?.guild_name || 'Loading…'}
          guildIcon={config?.guild_icon || null}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((v) => !v)}
        />
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel defaultSize={collapsed ? 96 : 82} minSize={72}>
        <div className="flex h-full flex-col overflow-hidden">
          <Navbar
            guildName={config?.guild_name || 'Loading…'}
            guildId={params!.guildId}
          />
          <main className="flex-1 overflow-y-auto scrollbar-thin">
            {configLoading ? (
              <div className="flex h-full items-center justify-center">
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Bot className="h-5 w-5 animate-pulse text-primary" />
                  <span>Loading server config…</span>
                </div>
              </div>
            ) : (
              <div className="mx-auto max-w-7xl px-6 py-8">{children}</div>
            )}
          </main>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
