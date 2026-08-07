'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  ArrowRight,
  Bot,
  Clock,
  Headphones,
  Radio,
  Shield,
  Sparkles,
  Volume2,
  Zap,
} from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const FEATURES = [
  {
    icon: Headphones,
    title: '24/7 Voice Connection',
    desc: 'Park the bot in any voice channel. Ghost detection, auto-rejoin, and a silent audio stream keep it alive forever.',
  },
  {
    icon: Radio,
    title: 'Streamer & Game Alerts',
    desc: 'Watch Kick, Twitch, and YouTube. Get pinged the moment someone goes live or a game goes free.',
  },
  {
    icon: Shield,
    title: 'Verification & Roles',
    desc: 'One-click verify button with role assignment, plus a bot-control role for who can use Leave / Force Leave.',
  },
  {
    icon: Activity,
    title: 'Voice Activity Logs',
    desc: 'Coloured embeds for joins, leaves, mutes, deafens, streams, and moves — posted to the channels you choose.',
  },
  {
    icon: Clock,
    title: 'VC Time Tracking',
    desc: 'Per-user session history, streaks, and leaderboards. Know who actually shows up.',
  },
  {
    icon: Sparkles,
    title: 'Welcome Cards',
    desc: 'Canvas-rendered welcome and leave cards with avatar, member count, and your server branding.',
  },
];

export default function Home() {
  const { user, loading, signIn } = useAuth();
  const router = useRouter();
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.replace(`/dashboard/${user.guilds[0]?.guildId || ''}`);
    }
  }, [user, loading, router]);

  const handleSignIn = async () => {
    setSigningIn(true);
    try {
      await signIn();
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-30" />
      <div className="pointer-events-none absolute inset-0 bg-radial-glow" />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[60rem] -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]" />

      <div className="relative z-10">
        <nav className="flex items-center justify-between px-6 py-5 lg:px-12">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-chart-4 shadow-lg shadow-primary/20">
              <Bot className="h-6 w-6 text-primary-foreground" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold tracking-wide text-foreground">
                24/7 POW Bot
              </span>
              <span className="text-xs text-muted-foreground">
                Control Panel
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://github.com/I-POW-I/247-Pow-Bot"
              target="_blank"
              rel="noreferrer"
              className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline"
            >
              GitHub
            </a>
            <Button
              onClick={handleSignIn}
              disabled={signingIn || loading}
              className="gap-2"
            >
              {signingIn ? 'Signing in…' : 'Sign in with Discord'}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </nav>

        <main className="mx-auto max-w-6xl px-6 pt-16 pb-24 lg:px-12 lg:pt-24">
          <div className="flex flex-col items-center text-center">
            <Badge
              variant="outline"
              className="mb-6 gap-1.5 border-primary/30 bg-primary/5 py-1.5 text-primary"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-success" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
              </span>
              Bot online · 2 active connections
            </Badge>

            <h1 className="max-w-4xl text-5xl font-bold leading-[1.05] tracking-tight text-foreground sm:text-6xl lg:text-7xl">
              The dashboard your{' '}
              <span className="text-gradient">24/7 voice bot</span> deserves.
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
              Manage voice 24/7, log channels, welcome cards, verification,
              streamer alerts, and game notifications — all from one
              ridiculously polished control panel.
            </p>

            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
              <Button
                size="lg"
                onClick={handleSignIn}
                disabled={signingIn || loading}
                className="h-12 gap-2 px-8 text-base shadow-lg shadow-primary/20"
              >
                {signingIn ? 'Connecting…' : 'Open Dashboard'}
                <ArrowRight className="h-5 w-5" />
              </Button>
              <span className="text-sm text-muted-foreground">
                No account? A demo session is created automatically.
              </span>
            </div>

            <div className="mt-16 grid w-full grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {[
                { icon: Volume2, label: '24/7 Voice' },
                { icon: Activity, label: 'Activity Logs' },
                { icon: Radio, label: 'Streamer Alerts' },
                { icon: Shield, label: 'Verification' },
                { icon: Clock, label: 'VC Tracking' },
                { icon: Zap, label: 'Owner Panel' },
              ].map((f) => (
                <div
                  key={f.label}
                  className="glass flex flex-col items-center gap-2 rounded-xl border border-border/60 px-3 py-4"
                >
                  <f.icon className="h-5 w-5 text-primary" />
                  <span className="text-xs font-medium text-muted-foreground">
                    {f.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-28 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="glass group rounded-2xl border border-border/60 p-6 transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-110">
                  <f.icon className="h-6 w-6" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-foreground">
                  {f.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>

          <footer className="mt-24 flex flex-col items-center justify-between gap-4 border-t border-border/60 pt-8 text-sm text-muted-foreground sm:flex-row">
            <span>
              Built for the 24/7 POW Bot. Not affiliated with Discord.
            </span>
            <span>v4.0 · Next.js 14 · Supabase</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
