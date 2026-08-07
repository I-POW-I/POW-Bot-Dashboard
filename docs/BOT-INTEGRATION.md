# POW Bot — Dashboard Integration Guide

This guide walks you through connecting your existing 24/7 POW Bot to the dashboard so they share the same Supabase database.

## Overview

Your bot currently stores config in a JSON file (`data/guild-config.json`) and uses `sql.js` locally. The dashboard stores its config in Supabase. This integration adds **five new feature modules** to your bot that read from Supabase — it does NOT touch your existing voice/24-7 logic.

```
Dashboard (Discloud site app)  ──writes──►  Supabase database  ◄──reads──  Bot (Discloud bot app)
```

## What you're adding

| Module | What it does | Discord events |
|--------|-------------|----------------|
| Automod | Word filter, link block, spam, caps, mention spam, invite block | `messageCreate` |
| Custom Commands | Custom prefix commands with text/embed/random responses | `messageCreate` |
| Reaction Roles | Self-assign roles via emoji reactions | `messageReactionAdd/Remove` |
| Tickets | Support ticket panels with open/close/claim | `interactionCreate`, `ready` |
| Webhooks | Fire webhooks on member join/leave + HTTP trigger | `guildMemberAdd/Remove` |

## Step 1 — Download your bot repo

```bash
git clone https://github.com/I-POW-I/POW-Bot.git pow-bot-test
cd pow-bot-test
```

Create a new test repo on GitHub and push:

```bash
git remote rename origin old-origin
git remote add origin https://github.com/I-POW-I/pow-bot-test.git
git push -u origin main
```

## Step 2 — Copy the bot-modules folder

Copy the entire `bot-modules/` folder from this dashboard project into your bot repo root:

```
pow-bot-test/
├── src/
├── commands/
├── events/
├── bot-modules/          ← copy this folder here
│   ├── index.js
│   ├── supabase-client.js
│   ├── automod.js
│   ├── custom-commands.js
│   ├── reaction-roles.js
│   ├── tickets.js
│   ├── webhooks.js
│   └── README.md
├── index.js
└── package.json
```

## Step 3 — Replace three files

From the `bot-integration/` folder in this project, copy these files into your bot repo, replacing the existing ones:

| File in this project | Replace in your bot repo |
|---------------------|------------------------|
| `bot-integration/index.js` | `index.js` (root) |
| `bot-integration/src/client.js` | `src/client.js` |
| `bot-integration/package.json` | `package.json` (root) |

### What changed in each file:

**`index.js`** — Added two things after the existing command/event loading:
1. `botModules.register(client)` — wires up the five modules
2. Optional HTTP server for webhook test triggers (only starts if `BOT_API_TOKEN` is set)

The bot still runs without Supabase env vars — it logs a warning and skips the modules. This lets you test the bot alone first.

**`src/client.js`** — Added:
- `GuildMessageReactions` intent (reaction roles need it)
- `GuildPresences` intent (optional, for future features)
- `Partials` for Message, Reaction, Channel (so reaction events work on old messages)

Your existing voice intents are unchanged.

**`package.json`** — Added `@supabase/supabase-js` to dependencies. Bumped version to 4.1.0.

## Step 4 — Update Discord Developer Portal

Go to **Discord Developer Portal → your app → Bot → Privileged Gateway Intents** and enable:

- ✅ MESSAGE CONTENT INTENT (automod + custom commands — you already have this)
- ✅ SERVER MEMBERS INTENT (webhooks on join/leave, ticket perms — you already have this)
- ✅ PRESENCE INTENT (new — needed if you use presence-based features)

## Step 5 — Install the new dependency

```bash
npm install
```

This installs `@supabase/supabase-js` from the updated `package.json`.

## Step 6 — Set environment variables

Create a `.env` file in the bot repo root (or set these on Discloud):

```env
# Existing (you already have these)
BOT_TOKEN=your-bot-token
CLIENT_ID=your-application-id

# NEW — copy these from the dashboard's .env or Discloud env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# NEW — optional, for webhook test triggers
BOT_API_TOKEN=your-shared-secret
```

**Important:** `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` must be the **same values** the dashboard uses. Copy them from the dashboard project's `.env` file or from the Discloud env settings for the dashboard app.

## Step 7 — Test locally

```bash
npm start
```

You should see:
```
[INFO] Dashboard feature modules registered (automod, custom commands, reaction roles, tickets, webhooks).
```

If you see the warning instead:
```
[WARN] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing — dashboard modules will be disabled.
```
Check your `.env` file has the correct Supabase values.

## Step 8 — Deploy to Discloud

1. Push your test bot repo to GitHub
2. Create a new Discloud app with `TYPE=bot`
3. Connect it to your test GitHub repo
4. Add the env vars (BOT_TOKEN, CLIENT_ID, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, BOT_API_TOKEN)
5. Deploy

Your existing Discloud bot app stays running untouched.

## Step 9 — Test the full flow

1. Open the dashboard URL (your Discloud site app)
2. Sign in with Discord
3. Select your test server
4. Configure a feature (e.g., add an automod rule)
5. Check the bot — within 60 seconds the rule should take effect

## What does NOT change

- Your voice 24/7 logic — completely untouched
- Your existing commands (`/panel`, `/setlogchannel`, `/status`, `/clearcommands`) — unchanged
- Your `data/guild-config.json` — still used for voice/log config
- Your `sql.js` database — still used for whatever you had it doing
- Your existing events folder — unchanged

The dashboard modules are **additive only**. They add new event listeners that run alongside your existing ones. The only shared event is `messageCreate` — the modules call `automod.evaluate(message)` then `customCommands.handleMessage(message)`, neither of which touches voice state or existing command handling.

## Troubleshooting

**Bot starts but modules don't work:**
- Check Supabase env vars are set correctly
- Check the bot can reach Supabase (Discloud bot apps have internet access)
- Check the Supabase tables exist (they're created by the dashboard's migrations)

**Reaction roles don't work:**
- Make sure `GuildMessageReactions` intent is enabled in both the code and Developer Portal
- Make sure the bot has "Manage Roles" permission in the server
- Make sure the bot's role is ABOVE the role it's trying to assign

**Tickets don't work:**
- Make sure the bot has "Manage Channels" permission
- Make sure a ticket config is saved in the dashboard for that server

**Webhook test button doesn't work:**
- This requires `BOT_API_TOKEN` to be set on both the bot and dashboard
- The bot's HTTP port (8081) must be reachable — Discloud bot apps may not expose HTTP ports by default, so this is optional
- The dashboard's webhooks page also fires tests directly to the Discord webhook URL as a fallback
