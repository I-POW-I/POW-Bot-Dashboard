# 24/7 POW Bot Dashboard

A production-grade Next.js 14 control panel for the [POW-Bot](https://github.com/I-POW-I/Pow-Bot) — a Discord bot that parks in a voice channel 24/7, logs voice activity, tracks VC time, and sends streamer/game alerts.

Built with **Next.js 14 (App Router)**, **TypeScript**, **Tailwind CSS**, **shadcn/ui**, **Recharts**, and **Supabase**.

## Features

The dashboard maps directly to the bot's actual commands and source code — no invented features.

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

## Tech stack

- **Framework**: Next.js 14 (App Router) + TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Charts**: Recharts
- **Database**: Supabase (Postgres + RLS)
- **Auth**: Supabase Auth + Discord OAuth2
- **Icons**: lucide-react
- **Fonts**: Inter (sans) + JetBrains Mono (mono)

## License

MIT. Built for my own discord bot, POW-Bot.
