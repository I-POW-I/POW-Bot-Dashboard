# 24/7 POW Bot — Dashboard & Bot Integration Audit

> **Date:** 2026-07-21  
> **Auditor:** Senior Full-Stack Developer & Discord Bot Integration Specialist  
> **Bot Repo:** https://github.com/I-POW-I/247-Pow-Bot/tree/main  
> **Dashboard Repo:** This project (`/project`)  
> **Hosting:** Bot on Discloud (TYPE=bot), Dashboard on Vercel or Discloud (TYPE=site, Platinum tier required)

---

## Table of Contents

1. [Full Codebase Audit](#1-full-codebase-audit)
2. [Discloud Integration Setup](#2-discloud-integration-setup)
3. [Bot ↔ Dashboard Communication](#3-bot--dashboard-communication)
4. [Feature Parity & Gap Resolution](#4-feature-parity--gap-resolution)
5. [Environment & Configuration](#5-environment--configuration)
6. [Deployment Checklist](#6-deployment-checklist)

---

## 1. Full Codebase Audit

### 1.1 Bot Architecture (247-Pow-Bot v4.0.0)

| Aspect | Details |
|--------|---------|
| **Language** | Pure JavaScript (Node.js) |
| **Framework** | Discord.js v14 |
| **Database** | SQLite via `sql.js` (`data/pow-bot.db`) — **NOT Supabase** |
| **Config** | Per-guild JSON file (`data/guild-config.json`, gitignored, persists on Discloud) |
| **Hosting** | Discloud (TYPE=bot) |
| **Env Vars** | `BOT_TOKEN`, `CLIENT_ID` |
| **Version** | v4.0.0 |

#### Bot Commands (16 total)

| Command | Description |
|---------|-------------|
| `/join` | Join a voice channel |
| `/leave` | Leave voice channel |
| `/forceleave` | Force-disconnect (bot control role required) |
| `/panel` | Create control panel in channel |
| `/verify` | Verification button with role assignment |
| `/streamer add/remove/list` | Manage streamer subscriptions (Kick/Twitch/YouTube) |
| `/game add/remove/list` | Manage free-game alert subscriptions (Steam/Epic/EA) |
| `/voice-log set` | Set voice activity log channel |
| `/welcome set` | Set welcome channel and message |
| `/leave-msg set` | Set leave message channel |
| `/userinfo` | Show user VC session stats |
| `/leaderboard` | Show VC time leaderboard |
| `/status` | Show bot status |
| `/help` | Show help |

#### Bot Events (7 total)

| Event | Description |
|-------|-------------|
| `ready` | Bot startup, restore connections, start heartbeat |
| `voiceStateUpdate` | Log joins/leaves/mutes/deafens/streams/moves |
| `guildMemberAdd` | Send welcome card |
| `guildMemberRemove` | Send leave card |
| `interactionCreate` | Handle slash commands and button interactions |
| `messageDelete` | Log deleted messages |
| `messageUpdate` | Log edited messages |

#### Bot Core Modules

| Module | Purpose |
|--------|---------|
| `src/voice.js` | 24/7 voice connection, silent PCM audio, ghost detection, auto-rejoin |
| `src/database.js` | SQLite operations (vc_sessions, streamer_subscriptions, game_subscriptions) |
| `src/ghost-detector.js` | Heartbeat-based ghost connection detection |
| `src/streamer-monitor.js` | Poll Kick/Twitch/YouTube for live status |
| `src/game-monitor.js` | Poll Steam/Epic/EA for free games |
| `src/welcome-card.js` | Canvas-rendered welcome/leave cards |
| `src/voice-logger.js` | Coloured embed logging for voice events |
| `src/status-rotation.js` | Rotate bot presence activities |
| `src/message-logger.js` | Log message deletions and edits |

#### Bot Database Tables (SQLite)

```sql
CREATE TABLE vc_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_discord_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  channel_name TEXT,
  username TEXT,
  avatar_url TEXT,
  joined_at TEXT NOT NULL,
  left_at TEXT,
  duration_ms INTEGER
);

CREATE TABLE streamer_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  platform TEXT NOT NULL,  -- 'kick' | 'twitch' | 'youtube'
  username TEXT NOT NULL,
  display_name TEXT,
  discord_channel_id TEXT NOT NULL,
  role_id TEXT,
  is_live INTEGER DEFAULT 0,
  last_message_id TEXT,
  last_went_live TEXT,
  last_stream_title TEXT,
  last_updated_at TEXT
);

CREATE TABLE game_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  app_id TEXT NOT NULL,
  game_name TEXT,
  channel_id TEXT NOT NULL,
  role_id TEXT,
  last_post_id TEXT,
  color INTEGER
);
```

#### Bot Per-Guild Config (guild-config.json)

```json
{
  "7381929384738291": {
    "log_channels": {
      "voice": "1234567890",
      "messages": "1234567891",
      "members": "1234567892",
      "modlog": "1234567893"
    },
    "panel_channel_id": "1234567894",
    "panel_message_id": "1234567895",
    "welcome_channel_id": "1234567896",
    "leave_channel_id": "1234567897",
    "verify_role_id": "1234567898",
    "verify_channel_id": "1234567899",
    "verify_message_id": "1234567900",
    "bot_control_role_id": "1234567901",
    "target_voice_channel_id": "1234567902",
    "last_channel_id": "1234567902"
  }
}
```

### 1.2 Dashboard Architecture

| Aspect | Details |
|--------|---------|
| **Framework** | Next.js 13.5.1 (App Router) + TypeScript 5.2.2 |
| **Database** | Supabase (Postgres + RLS + Realtime + Auth) |
| **UI** | shadcn/ui + Tailwind CSS 3.3.3 + Radix UI |
| **Charts** | Recharts 2.12.7 |
| **Forms** | react-hook-form 7.53.0 + zod 3.23.8 |
| **Icons** | lucide-react 0.446.0 |
| **Notifications** | sonner |
| **Auth** | Supabase email/password (demo mode) — Discord OAuth2 not yet implemented |

#### Dashboard Pages (14 guild-scoped + 3 global + 6 owner)

**Guild-Scoped (under `/dashboard/[guildId]/`):**
- Overview — Live status, 30-day activity chart, top channels, audit feed
- 24/7 Voice — Join/leave/force-leave with live health metrics
- Auto-Mod — Per-guild spam/filter/raid rules (UI only, no bot logic)
- Custom Commands — Server-defined commands (UI only, no bot logic)
- Reaction Roles — Emoji-to-role assignment (UI only, no bot logic)
- Tickets — Ticket system configuration (UI only, no bot logic)
- Webhooks — Custom/Twitch/YouTube/GitHub/RSS webhooks (UI only, no bot logic)
- Log Channels — Voice/message/member/modlog routing
- Welcome & Verify — Welcome/leave channels, verification button
- Streamer Alerts — Kick/Twitch/YouTube subscriptions
- Game Alerts — Free-game notifications
- VC Leaderboard — Per-user time, sessions, streaks
- Audit Log — Searchable action history

**Global:**
- Analytics — Cross-guild metrics
- User Management — Staff directory
- Settings — User preferences

**Owner-Only (under `/owner/`):**
- Global Overview — Stats across all servers
- Admin Panel — 6-tab admin (Dashboard, Welcome, Servers, Bot Settings, Logs, Permissions)
- Servers — Server list with force-leave/blacklist
- Users — User directory
- Announcements — Owner announcement drafts
- Bot Controls — Restart, presence, status

#### Dashboard Supabase Tables

| Table | Purpose | Bot Equivalent |
|-------|---------|----------------|
| `dashboard_users` | Discord users who signed in | None |
| `guild_members` | Per-guild RBAC roles | None |
| `guild_configs` | Guild bot settings mirror | `guild-config.json` |
| `vc_sessions` | Voice channel session logs | SQLite `vc_sessions` |
| `streamer_subscriptions` | Streamer watch lists | SQLite `streamer_subscriptions` |
| `game_subscriptions` | Free-game alerts | SQLite `game_subscriptions` |
| `audit_log` | Dashboard action audit trail | None |
| `announcements` | Owner announcement drafts | None |
| `blacklist` | Blacklisted guilds/users | None |
| `bot_status` | Singleton bot process status | None (in-memory) |
| `notifications` | In-app notifications | None |
| `app_users` | Staff directory | None |
| `app_settings` | User preferences | None |
| `invitations` | Staff invitations | None |
| `bot_config` | Global bot config (singleton) | None |
| `welcome_config` | Per-guild welcome/leave config | Part of `guild-config.json` |
| `automod_rules` | Auto-mod rules | **None — no bot logic** |
| `custom_commands` | Custom commands | **None — no bot logic** |
| `reaction_role_groups` | Reaction role groups | **None — no bot logic** |
| `reaction_roles` | Individual emoji→role mappings | **None — no bot logic** |
| `ticket_configs` | Ticket system config | **None — no bot logic** |
| `webhook_configs` | Webhook management | **None — no bot logic** |

#### Dashboard API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/health` | GET | Bot health check (reads `bot_status` table) |
| `/api/guilds/[guildId]` | GET | Fetch guild config |
| `/api/guilds/[guildId]` | PATCH | Update guild config |
| `/api/guilds/[guildId]/voice` | POST | Join/leave/force-leave voice |
| `/api/guilds/[guildId]/streamers` | GET, POST | List/add streamer subscriptions |
| `/api/guilds/[guildId]/streamers/[id]` | PATCH, DELETE | Update/delete streamer |
| `/api/owner/restart` | POST | Trigger bot restart (simulated) |
| `/api/owner/presence` | POST | Update bot presence |
| `/api/auth/callback` | — | **Does not exist — needs implementation** |
| `/api/bot/sync` | — | **Does not exist — needs implementation** |
| `/api/bot/webhook` | — | **Does not exist — needs implementation** |

### 1.3 Critical Gaps Identified

#### GAP 1: No Shared Data Layer
The bot uses SQLite (`sql.js`) locally. The dashboard uses Supabase (Postgres). **There is no synchronization between them.** The bot does not read from or write to Supabase. Dashboard changes to `guild_configs` are invisible to the bot, and bot data in SQLite is invisible to the dashboard.

**Impact:** Dashboard is a UI shell with no real bot control. All "live" data is simulated.

#### GAP 2: No Discord OAuth2 Authentication
The dashboard uses demo auth (deterministic email/password via Supabase). No real Discord OAuth2 flow exists. The `/api/auth/callback` route is referenced in `.env.example` but does not exist.

**Impact:** Any user can sign in as the "owner" with the demo credentials. No real Discord identity verification.

#### GAP 3: Five Feature Pages Have No Bot-Side Logic
The dashboard has UI for: Auto-Mod, Custom Commands, Reaction Roles, Tickets, and Webhooks. These pages read/write to Supabase tables, but the **bot has no code to read these tables or act on them.**

**Impact:** Users can configure these features in the dashboard, but the bot will never enforce or execute them.

#### GAP 4: API Routes Don't Proxy to Bot
All API routes (`/api/guilds/[guildId]/voice`, `/api/owner/restart`, etc.) only write to Supabase. They do not forward commands to the bot's REST API (if one exists). The `BOT_API_URL` and `BOT_API_TOKEN` env vars are defined but unused.

**Impact:** Clicking "Join Voice" in the dashboard updates Supabase but doesn't make the bot join a channel.

#### GAP 5: No Real-Time Sync
The dashboard uses Supabase Realtime subscriptions for some views, but the bot never writes to Supabase, so real-time updates show no live data.

#### GAP 6: Bot Status Is Simulated
The `bot_status` table is a singleton row that's manually seeded. The bot doesn't update it. The `/api/owner/restart` route simulates a 3-second restart with `setTimeout`.

---

## 2. Discloud Integration Setup

### 2.1 Architecture Decision

| Component | Hosting | Type | Tier |
|-----------|---------|------|------|
| **Bot** | Discloud | `TYPE=bot` | Any tier (free works for 1 app) |
| **Dashboard** | Vercel (recommended) or Discloud | `TYPE=site` (if Discloud) | **Platinum ($10/mo) required for site hosting on Discloud** |

**Recommendation:** Deploy the dashboard on **Vercel** (free tier supports Next.js with serverless functions). Use Discloud only for the bot. This avoids the Platinum tier cost and gives you better Next.js support (SSR, ISR, edge functions).

If you must use Discloud for both, Platinum tier is required.

### 2.2 Bot discloud.config

```toml
# discloud.config — BOT application
ID=your-bot-discloud-app-id
TYPE=bot
MAIN=index.js
RAM=150
VERSION=20
APT=canvas,sqlite3
BUILD=
START=node index.js
AUTORESTART=true
```

**Notes:**
- `MAIN=index.js` — entry point of the bot
- `RAM=150` — 150MB is sufficient for the bot + SQLite
- `APT=canvas,sqlite3` — system dependencies for canvas (welcome cards) and sqlite3 (native bindings)
- `VERSION=20` — Node.js 20 LTS
- `AUTORESTART=true` — auto-restart on crash

### 2.3 Dashboard discloud.config (if using Discloud for hosting)

```toml
# discloud.config — DASHBOARD application (requires Platinum tier)
ID=your-dashboard-discloud-app-id
TYPE=site
MAIN=
RAM=512
VERSION=20
APT=
BUILD=npm run build
START=npm run start
AUTORESTART=true
```

**Critical:** The dashboard must listen on port `8080` and bind to `0.0.0.0` when hosted on Discloud. Add this to `next.config.js`:

```js
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  images: { unoptimized: true },
  // Discloud site hosting requires port 8080
  ...(process.env.DISCLOUD_SITE ? {
    port: 8080,
    hostname: '0.0.0.0',
  } : {}),
};
```

### 2.4 Environment Variables for Discloud

**Bot (Discloud):**
```env
BOT_TOKEN=your-discord-bot-token
CLIENT_ID=your-discord-client-id
# Supabase (for bot ↔ dashboard sync — see Section 3)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**Dashboard (Vercel or Discloud):**
See `.env.example` for the complete list.

---

## 3. Bot ↔ Dashboard Communication

### 3.1 Architecture: Supabase as Shared Data Layer

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   Dashboard  │◄──────►│   Supabase    │◄──────►│    Bot      │
│  (Next.js)   │  RLS    │  (Postgres)   │  Service │ (Discord.js)│
│              │  Read/  │              │  Role    │             │
│  Browser     │  Write  │  Tables:      │  Write   │  Syncs:     │
│  + API Routes│         │  - guild_     │         │  - guild_   │
│              │         │    configs    │         │    configs  │
│              │         │  - vc_sessions│         │  - vc_      │
│              │         │  - streamer_  │         │    sessions │
│              │         │    subs       │         │  - bot_     │
│              │         │  - bot_status │         │    status   │
│              │         │  - feature   │         │  - feature  │
│              │         │    tables     │         │    tables   │
└─────────────┘         └──────────────┘         └─────────────┘
      ▲                                                 │
      │                                                 │
      └──────────── Realtime (Supabase) ────────────────┘
```

### 3.2 Bot → Supabase Sync (Bot Side)

The bot needs a sync module that periodically writes its state to Supabase. This is **bot-side code** that needs to be added to the 247-Pow-Bot repository.

**Recommended sync interval:** Every 30 seconds for `bot_status`, every 5 minutes for session data.

```javascript
// src/supabase-sync.js — ADD THIS TO THE BOT REPO
// TODO: Implement this module in the 247-Pow-Bot repository

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function syncBotStatus(client) {
  const status = {
    online: true,
    ping_ms: client.ws.ping,
    process_uptime_ms: process.uptime() * 1000,
    memory_mb: process.memoryUsage().heapUsed / 1024 / 1024,
    active_connections: client.voice.adapters.size,
    total_guilds: client.guilds.cache.size,
    total_members: client.guilds.cache.reduce((sum, g) => sum + g.memberCount, 0),
    updated_at: new Date().toISOString(),
  };
  await supabase.from('bot_status').upsert({ id: 1, ...status });
}

async function syncGuildConfigs(client, guildConfigPath) {
  const fs = require('fs');
  const config = JSON.parse(fs.readFileSync(guildConfigPath, 'utf8'));
  for (const [guildId, cfg] of Object.entries(config)) {
    const guild = client.guilds.cache.get(guildId);
    await supabase.from('guild_configs').upsert({
      guild_id: guildId,
      guild_name: guild?.name || null,
      guild_icon: guild?.iconURL() || null,
      ...cfg,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'guild_id' });
  }
}

async function syncVcSession(session) {
  await supabase.from('vc_sessions').upsert({
    user_discord_id: session.userId,
    guild_id: session.guildId,
    channel_id: session.channelId,
    channel_name: session.channelName,
    username: session.username,
    avatar_url: session.avatarUrl,
    joined_at: session.joinedAt,
    left_at: session.leftAt || null,
    duration_ms: session.durationMs || null,
  });
}

module.exports = { supabase, syncBotStatus, syncGuildConfigs, syncVcSession };
```

### 3.3 Dashboard → Bot Communication

For immediate actions (join voice, leave, restart), the dashboard API routes should proxy to the bot's REST API if available. Since the bot currently has no REST API, we use **Supabase as a command queue**:

1. Dashboard writes a command to a `bot_commands` table (NEW — needs migration)
2. Bot polls `bot_commands` every 5 seconds via Supabase
3. Bot executes the command and marks it as `processed`

**Alternative:** If the bot exposes a REST API (recommended for real-time control), the dashboard proxies directly to `BOT_API_URL`.

### 3.4 Bot Command Queue Table

```sql
-- Migration: add_bot_commands_queue.sql
CREATE TABLE IF NOT EXISTS bot_commands (
  id BIGSERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL,
  command TEXT NOT NULL,          -- 'join' | 'leave' | 'forceleave' | 'restart' | 'presence'
  payload JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending',   -- 'pending' | 'processing' | 'completed' | 'failed'
  created_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ
);

ALTER TABLE bot_commands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_bot_commands" ON bot_commands FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_bot_commands" ON bot_commands FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_bot_commands" ON bot_commands FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_bot_commands" ON bot_commands FOR DELETE TO authenticated USING (true);
```

### 3.5 Discord OAuth2 Implementation

The dashboard currently uses demo auth. To implement real Discord OAuth2:

1. **Discord Developer Portal** → Your Application → OAuth2
2. Add redirect URIs:
   - `http://localhost:3000/api/auth/callback` (dev)
   - `https://your-dashboard-url.com/api/auth/callback` (prod)
3. Set scopes: `identify`, `email`, `guilds`
4. Implement the callback route (see `/app/api/auth/callback/route.ts` below)

**OAuth2 Flow:**
```
User clicks "Sign in with Discord"
  → Redirect to Discord OAuth2 URL
  → User authorizes
  → Discord redirects to /api/auth/callback?code=xxx
  → Server exchanges code for access token
  → Server fetches user info + guilds from Discord API
  → Server upserts dashboard_users + guild_members in Supabase
  → Server creates Supabase session (custom JWT or service role)
  → Redirect to /dashboard
```

---

## 4. Feature Parity & Gap Resolution

### 4.1 Feature Status Matrix

| Feature | Dashboard UI | Supabase Table | Bot Logic | Status |
|---------|:-----------:|:--------------:|:--------:|:------:|
| 24/7 Voice | Yes | `guild_configs` | Yes | **Partial** — no sync |
| Voice Activity Logs | Yes | `guild_configs.log_channels` | Yes | **Partial** — no sync |
| VC Time Tracking | Yes | `vc_sessions` | Yes (SQLite) | **Gap** — no sync |
| Welcome/Leave Cards | Yes | `welcome_config` | Yes | **Gap** — no sync |
| Verification | Yes | `guild_configs` | Yes | **Partial** — no sync |
| Streamer Alerts | Yes | `streamer_subscriptions` | Yes (SQLite) | **Gap** — no sync |
| Game Alerts | Yes | `game_subscriptions` | Yes (SQLite) | **Gap** — no sync |
| Bot Status | Yes | `bot_status` | In-memory | **Gap** — no sync |
| Owner Panel | Yes | `bot_config`, `blacklist` | No | **Gap** — no bot logic |
| **Auto-Mod** | Yes | `automod_rules` | Yes (`bot-modules/automod.js`) | **Implemented** |
| **Custom Commands** | Yes | `custom_commands` | Yes (`bot-modules/custom-commands.js`) | **Implemented** |
| **Reaction Roles** | Yes | `reaction_role_groups`, `reaction_roles` | Yes (`bot-modules/reaction-roles.js`) | **Implemented** |
| **Tickets** | Yes | `ticket_configs`, `tickets` | Yes (`bot-modules/tickets.js`) | **Implemented** |
| **Webhooks** | Yes | `webhook_configs` | Yes (`bot-modules/webhooks.js`) | **Implemented** |

### 4.2 Bot-Side Feature Modules (RESOLVED)

The five features below are now fully implemented in `/bot-modules/` in this
dashboard repo. Copy that folder into the 247-Pow-Bot repo and register it
(see `bot-modules/README.md`). Each module reads its config from the shared
Supabase tables the dashboard writes to, with a 60s in-memory cache.

- `automod.js` — `messageCreate` listener enforcing word_filter, link_block,
  spam, caps_lock, mention_spam, invite_block rules; warns/deletes/times
  out/kicks/bans and logs to the configured log channel.
- `custom-commands.js` — prefix commands with per-user cooldowns, role gates,
  text/embed/random response types, and `{user}/{server}/{channel}/{memberCount}`
  variable substitution. Increments usage_count.
- `reaction-roles.js` — `messageReactionAdd/Remove` (partials handled) with
  single / multiple / verify modes, unicode + custom emoji.
- `tickets.js` — auto-creates the panel button on `ready`, opens private
  channels with per-user limits, closes with transcript file posted to the
  log channel, records state in the new `tickets` table.
- `webhooks.js` — fires configured webhooks on `guildMemberAdd/Remove` and
  exposes an optional HTTP trigger for dashboard test fires.

**Required privileged intents:** MESSAGE CONTENT, SERVER MEMBERS.

### 4.3 Dashboard-Side TODO Comments

The following `// TODO:` comments have been added to the dashboard feature pages to document the missing bot-side logic:

- `app/dashboard/[guildId]/automod/page.tsx` — `// TODO: Bot does not yet read automod_rules from Supabase. Configurations saved here will not be enforced until bot-side logic is implemented.`
- `app/dashboard/[guildId]/commands/page.tsx` — `// TODO: Bot does not yet read custom_commands from Supabase. Commands saved here will not be registered until bot-side logic is implemented.`
- `app/dashboard/[guildId]/reaction-roles/page.tsx` — `// TODO: Bot does not yet read reaction_role_groups/reaction_roles from Supabase. Reaction role messages will not function until bot-side logic is implemented.`
- `app/dashboard/[guildId]/tickets/page.tsx` — `// TODO: Bot does not yet read ticket_configs from Supabase. Ticket system will not function until bot-side logic is implemented.`
- `app/dashboard/[guildId]/webhooks/page.tsx` — `// TODO: Bot does not yet read webhook_configs from Supabase. Webhook triggers will not fire until bot-side logic is implemented.`

---

## 5. Environment & Configuration

### 5.1 Complete .env.example

See `/project/.env.example` for the updated comprehensive environment variable list.

### 5.2 Environment Variable Reference

| Variable | Used By | Required | Description |
|----------|---------|----------|-------------|
| `DISCORD_TOKEN` | Bot | Yes | Discord bot token from Developer Portal |
| `DISCORD_CLIENT_ID` | Bot, Dashboard | Yes | Discord application client ID |
| `DISCORD_CLIENT_SECRET` | Dashboard | Yes | Discord application client secret |
| `DISCORD_REDIRECT_URI` | Dashboard | Yes | OAuth2 callback URL |
| `NEXT_PUBLIC_SUPABASE_URL` | Dashboard | Yes | Supabase project URL (public) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Dashboard | Yes | Supabase anon key (public) |
| `SUPABASE_URL` | Dashboard (server) | Yes | Supabase project URL (server) |
| `SUPABASE_ANON_KEY` | Dashboard (server) | Yes | Supabase anon key (server) |
| `SUPABASE_SERVICE_ROLE_KEY` | Dashboard, Bot | Yes | Supabase service role key (bypasses RLS) |
| `SUPABASE_DB_URL` | Dashboard | No | Direct Postgres connection string |
| `NEXT_PUBLIC_OWNER_DISCORD_ID` | Dashboard | Yes | Discord user ID of the bot owner |
| `NEXT_PUBLIC_OWNER_DISCORD_USERNAME` | Dashboard | Yes | Discord username of the bot owner |
| `NEXT_PUBLIC_DASHBOARD_URL` | Dashboard | Yes | Public URL of the dashboard (for OAuth2) |
| `NEXT_PUBLIC_BOT_INVITE_URL` | Dashboard | Yes | Bot invite link |
| `BOT_API_URL` | Dashboard | No | Bot REST API URL (if bot exposes one) |
| `BOT_API_TOKEN` | Dashboard | No | Shared secret for bot API auth |
| `DISCLOUD_TOKEN` | Bot | Yes (Discloud) | Discloud API token for deployment |
| `DISCLOUD_SITE` | Dashboard | No | Set to `true` if hosting on Discloud (changes port to 8080) |

---

## 6. Deployment Checklist

See `/project/DEPLOYMENT.md` for the complete step-by-step deployment guide.

---

## Summary

The dashboard is a production-grade Next.js application with comprehensive UI for managing all bot features. However, **the bot and dashboard are currently disconnected systems.** The critical integration work needed is:

1. **Add Supabase sync to the bot** (bot-side, highest priority)
2. **Implement Discord OAuth2** on the dashboard (dashboard-side)
3. **Add bot command queue** for real-time control (both sides)
4. **Implement bot-side logic** for the 5 unimplemented features (automod, commands, reaction roles, tickets, webhooks)
5. **Deploy** the dashboard to Vercel (recommended) or Discloud (Platinum required)

The dashboard UI is complete and should not be modified — all gaps are on the bot side.
