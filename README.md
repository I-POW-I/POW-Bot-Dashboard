# 24/7 POW Bot Dashboard

A production-grade Next.js 14 dashboard / control panel for the [POW-Bot](https://github.com/I-POW-I/POW-Bot) — a Discord bot that stays in a voice channel 24/7, logs voice activity, tracks VC time, and sends your selected streamers gone live, game updates & free games notifications for steam & epic games.

Built with **Next.js 14 (App Router)**, **TypeScript**, **Tailwind CSS**, **shadcn/ui**, **Recharts**, and **Supabase**.

## Features

The dashboard maps directly to the bot's actual commands and source code.

### Per-server dashboard

- **Overview** — live bot status, server stats, 30-day voice activity chart, top channels, recent audit feed, quick actions (restart / clear cache / sync slash commands).
- **24/7 Voice** — the bot's core feature. Pick a voice channel from a dropdown, join / leave / force-leave, live connection health (uptime, ping, active VCs, presence), and the list of members currently in the channel.
- **Log Channels** — mirrors the `/setlogs` command. Configure where voice activity, message delete/edit, member join/leave, and moderation action logs are posted.
- **Welcome & Verification** — mirrors `/welcome` and `/verify`. Set welcome/leave channels, configure the verification button (role + embed title/description), and set the bot-control role for who can use Leave / Force Leave on the live panel.
- **Streamer Alerts** — mirrors `/addstreamer` / `/removestreamer`. Watch Kick, Twitch, and YouTube channels; get pinged when they go live.
- **Game Alerts** — mirrors `/gamealerts`. Subscribe to games and get notified when they go free or post news.
- **VC Leaderboard** — per-user total VC time, sessions, and streaks from the bot's `vc_sessions` table. Podium for the top 3.
- **Audit Log** — searchable, filterable table of every dashboard action.

### Owner panel (`/owner`)

Protected by your Discord user ID (set as `NEXT_PUBLIC_OWNER_DISCORD_ID`). Only accessible when your global role is `owner`.

- **Global Overview** — total servers, total members, active VCs, process uptime, memory, ping, presence, and the full server list.
- **Servers** — search, sort by name or join date, view any server's dashboard as admin, blacklist a server.
- **Users** — search any Discord user the bot has seen, view their VC stats across servers, blacklist a user globally.
- **Announcements** — compose an embed (title, body, color), select target servers (or all), preview, and send. History of past announcements.
- **Bot Controls** — trigger a bot restart, change the bot's presence (Playing / Watching / Listening / Custom + text), and view live process metrics.

## Architecture

```
app/
  page.tsx                          # Landing / login
  dashboard/
    page.tsx                        # Server switcher
    [guildId]/
      layout.tsx                    # Sidebar + navbar shell
      page.tsx                      # Overview
      voice/page.tsx                # 24/7 voice
      logging/page.tsx              # Log channels
      welcome/page.tsx              # Welcome & verify
      streamers/page.tsx             # Streamer alerts
      games/page.tsx                # Game alerts
      leaderboard/page.tsx         # VC leaderboard
      audit/page.tsx                # Audit log
  owner/
    layout.tsx                      # Owner-only shell
    page.tsx                        # Global overview
    servers/page.tsx                # Server management
    users/page.tsx                  # User management
    announcements/page.tsx          # Announcement system
    controls/page.tsx               # Bot controls
  api/
    health/route.ts
    guilds/[guildId]/route.ts
    guilds/[guildId]/voice/route.ts
    guilds/[guildId]/streamers/route.ts
    guilds/[guildId]/streamers/[id]/route.ts
    owner/restart/route.ts
    owner/presence/route.ts
components/
  ui/                               # shadcn/ui components
  dashboard/                        # Feature components (sidebar, navbar, stat-card, activity-chart, audit-feed)
  providers/auth-provider.tsx       # Auth context
lib/
  supabase.ts                       # Supabase client
  auth.ts                           # Discord OAuth + RBAC helpers
  data.ts                           # Data-fetching helpers
types/
  index.ts                          # All TypeScript interfaces
```

## Authentication & RBAC

The dashboard uses Supabase Auth as the session layer. In production, a Discord OAuth2 callback (`/api/auth/callback`) creates or updates a `dashboard_users` row and links it to the Supabase auth user. In the demo build, `signInDemoUser()` in `lib/auth.ts` performs the same flow using a deterministic email/password so you can explore the dashboard without setting up Discord OAuth.

Roles:

| Role | Scope | Permissions |
|------|-------|-------------|
| `owner` | Global | Full god-mode across all servers + owner panel |
| `admin` | Per-guild | Full control over their server's bot settings |
| `moderator` | Per-guild | Log channels, streamer/game alerts |
| `viewer` | Per-guild | Read-only access to all panels |

All RLS policies enforce these roles at the database level — the dashboard UI is just a convenience layer.

## Database schema

Ten tables, all with RLS enabled. See the migration in the Supabase project for the full schema:

- `dashboard_users` — Discord identity + global role
- `guild_members` — per-guild RBAC role for each user
- `guild_configs` — per-guild bot config (log channels, panel, welcome, verify, target VC, etc.)
- `vc_sessions` — voice channel session log (mirrors the bot's SQLite table)
- `streamer_subscriptions` — Kick / Twitch / YouTube watch list
- `game_subscriptions` — game alert subscriptions
- `audit_log` — dashboard action audit trail
- `announcements` — owner announcement drafts + history
- `blacklist` — blacklisted guilds/users
- `bot_status` — singleton row with live bot process metrics

## Setup

### Prerequisites

- Node.js 18+
- A Supabase project (pre-provisioned in the Bolt environment)
- The 24/7 POW Bot running and connected to your Supabase project (or use the seeded demo data)

### Install

```bash
npm install
```

### Environment variables

Copy `.env.example` to `.env.local` and fill in the values. The Supabase vars are pre-populated in the hosted environment. You only need to set:

- `NEXT_PUBLIC_OWNER_DISCORD_ID` — your Discord user ID (for owner panel access)
- `NEXT_PUBLIC_OWNER_DISCORD_USERNAME` — your Discord username
- `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` — for real Discord OAuth (optional in demo mode)

### Run

The dev server starts automatically in the Bolt environment. For local development:

```bash
npm run dev
```

### Build

```bash
npm run build
```

## Connecting to the bot's backend

The dashboard reads from Supabase tables that mirror the bot's local state. To sync live data from the bot:

1. **Bot → Supabase**: Add a small sync module to the bot that writes its `connectionStore`, `guildConfig`, and `database` state to the corresponding Supabase tables every 30–60 seconds. The bot already has all the data in memory — this is just a `fetch` POST to the Supabase REST API.

2. **Dashboard → Bot**: For actions that need an immediate bot response (join/leave/restart), the dashboard's API routes can proxy to the bot's REST API. Set `BOT_API_URL` and `BOT_API_TOKEN` in `.env.local` and the route handlers will forward the request.

The demo build works without any bot connection — the seeded data in Supabase is enough to explore every page.

## Tech stack

- **Framework**: Next.js 14 (App Router) + TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Charts**: Recharts
- **Database**: Supabase (Postgres + RLS)
- **Auth**: Supabase Auth + Discord OAuth2
- **Icons**: lucide-react
- **Fonts**: Inter (sans) + JetBrains Mono (mono)

## License

MIT. Built for the 24/7 POW Bot community.
