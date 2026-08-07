# 24/7 POW Bot — Deployment Checklist

> Step-by-step guide to deploy the dashboard and connect it with the live Discord bot.

---

## Phase 1: Supabase Setup

### 1.1 Create a Supabase Project
1. Go to [supabase.com](https://supabase.com) and sign in
2. Click "New Project" → choose a name, set a strong database password
3. Wait for provisioning to complete (~2 minutes)
4. Go to Settings → API to find:
   - `Project URL` → this is your `SUPABASE_URL`
   - `anon public` key → `SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`
5. Go to Settings → Database → Connection string → `SUPABASE_DB_URL`

### 1.2 Run Migrations
The migrations are in `/supabase/migrations/`. Apply them in order:

1. `20260720032625_create_dashboard_schema.sql` — Core tables
2. `20260720121439_add_notifications_users_settings_invitations.sql` — Enhanced tables
3. `20260720121500_make_invited_by_nullable.sql` — Schema fix
4. `20260720154711_add_bot_config_welcome_config.sql` — Bot config + welcome
5. `20260721010741_add_feature_tables_automod_commands_reaction_roles_tickets_webhooks.sql` — Feature tables
6. `add_bot_commands_queue.sql` — Bot command queue (applied via MCP)

Run via the Supabase SQL Editor or the MCP `apply_migration` tool.

### 1.3 Seed Initial Data
Insert a row into `bot_status` (singleton):

```sql
INSERT INTO bot_status (id, online, ping_ms, process_uptime_ms, memory_mb, active_connections, total_guilds, total_members)
VALUES (1, false, 0, 0, 0, 0, 0, 0)
ON CONFLICT (id) DO NOTHING;
```

---

## Phase 2: Discord OAuth2 Setup

### 2.1 Create a Discord Application
1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" → name it "24/7 POW Bot Dashboard"
3. Copy the **Client ID** → `DISCORD_CLIENT_ID`
4. Copy the **Client Secret** → `DISCORD_CLIENT_SECRET`

### 2.2 Configure OAuth2 Redirect URIs
1. Go to OAuth2 → Redirects
2. Add these redirect URIs:
   - `http://localhost:3000/api/auth/callback` (development)
   - `https://your-dashboard-url.vercel.app/api/auth/callback` (production)
3. Save changes

### 2.3 Get Your Bot Token
1. Go to the Bot tab → click "Reset Token" → copy it → `DISCORD_TOKEN` (bot only)
2. Under "Privileged Gateway Intents", enable:
   - Presence Intent
   - Server Members Intent
   - Message Content Intent

### 2.4 Generate Bot Invite URL
1. Go to OAuth2 → URL Generator
2. Scopes: `bot`, `applications.commands`
3. Bot Permissions:
   - Connect, Speak
   - View Channels, Read Messages
   - Send Messages, Embed Links
   - Manage Roles, Moderate Members
   - Add Reactions, Use External Emojis
4. Copy the URL → `NEXT_PUBLIC_BOT_INVITE_URL`

### 2.5 Get Your Discord User ID
1. In Discord, enable Developer Mode (Settings → Advanced → Developer Mode)
2. Right-click your username → "Copy ID" → `NEXT_PUBLIC_OWNER_DISCORD_ID`
3. Your username → `NEXT_PUBLIC_OWNER_DISCORD_USERNAME`

---

## Phase 3: Dashboard Deployment (Vercel — Recommended)

### 3.1 Push to GitHub
```bash
git add .
git commit -m "feat: integration audit + OAuth2 + bot bridge"
git push origin main
```

### 3.2 Deploy on Vercel
1. Go to [vercel.com](https://vercel.com) and sign in
2. Click "New Project" → import your GitHub repo
3. Framework preset: Next.js (auto-detected)
4. Add all environment variables (see `.env.example`):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_DB_URL`
   - `DISCORD_CLIENT_ID`
   - `DISCORD_CLIENT_SECRET`
   - `DISCORD_REDIRECT_URI` → `https://your-app.vercel.app/api/auth/callback`
   - `NEXT_PUBLIC_DASHBOARD_URL` → `https://your-app.vercel.app`
   - `NEXT_PUBLIC_BOT_INVITE_URL`
   - `NEXT_PUBLIC_OWNER_DISCORD_ID`
   - `NEXT_PUBLIC_OWNER_DISCORD_USERNAME`
   - `BOT_API_URL` → your bot's API URL (if available)
   - `BOT_API_TOKEN` → shared secret (generate a random string)
5. Click "Deploy"
6. Wait for build to complete

### 3.3 Update OAuth2 Redirect URI
After deployment, go back to Discord Developer Portal → OAuth2 → Redirects:
- Add your production URL: `https://your-app.vercel.app/api/auth/callback`
- Update `DISCORD_REDIRECT_URI` in Vercel env vars to match

### 3.4 Alternative: Deploy on Discloud (Platinum Required)
If using Discloud instead of Vercel:
1. Set `DISCLOUD_SITE=true` in your env
2. Use the `discloud.config` in this project
3. Deploy via Discloud CLI or dashboard
4. The app will listen on port 8080

---

## Phase 4: Bot Deployment (Discloud)

### 4.1 Prepare Bot Environment
1. Clone the bot repo: `git clone https://github.com/I-POW-I/247-Pow-Bot.git`
2. Create a `discloud.config` in the bot root:

```toml
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

3. Create a `.env` file for the bot:

```env
BOT_TOKEN=your-discord-bot-token
CLIENT_ID=your-discord-client-id
# Supabase sync (for bot ↔ dashboard communication)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
# Bot API token (must match dashboard's BOT_API_TOKEN)
BOT_API_TOKEN=your-shared-secret
# Dashboard URL (for syncing state)
DASHBOARD_API_URL=https://your-app.vercel.app
```

### 4.2 Add Supabase Sync to the Bot
The bot needs a sync module. Add `src/supabase-sync.js` to the bot repo (see INTEGRATION.md Section 3.2 for the full code).

In the bot's `index.js` (or main entry point):
```javascript
const { syncBotStatus, syncGuildConfigs } = require('./src/supabase-sync');

// On ready
client.once('ready', () => {
  // ... existing code ...

  // Sync bot status every 30 seconds
  setInterval(() => syncBotStatus(client), 30_000);

  // Sync guild configs every 5 minutes
  setInterval(() => syncGuildConfigs(client, 'data/guild-config.json'), 300_000);

  // Initial sync
  syncBotStatus(client);
  syncGuildConfigs(client, 'data/guild-config.json');
});
```

### 4.3 Add Bot Command Polling
Add command polling to the bot:

```javascript
const { pollCommands, markCommandProcessed } = require('./src/supabase-sync');

// Poll for pending commands every 5 seconds
setInterval(async () => {
  const commands = await pollCommands();
  for (const cmd of commands) {
    try {
      // Execute command
      if (cmd.command === 'join') {
        const guild = client.guilds.cache.get(cmd.guild_id);
        const channel = guild?.channels.cache.get(cmd.payload.channelId);
        if (channel) await joinVoiceChannel(channel);
      } else if (cmd.command === 'leave') {
        // leave voice in cmd.guild_id
      } else if (cmd.command === 'forceleave') {
        // force leave in cmd.guild_id
      } else if (cmd.command === 'restart') {
        process.exit(1); // Discloud autorestart will restart
      } else if (cmd.command === 'presence') {
        client.user.setPresence({
          activities: [{ name: cmd.payload.text, type: cmd.payload.type }],
          status: 'online',
        });
      }
      await markCommandProcessed(cmd.id, 'completed');
    } catch (err) {
      await markCommandProcessed(cmd.id, 'failed', err.message);
    }
  }
}, 5_000);
```

### 4.4 Deploy the Bot on Discloud
1. Install Discloud CLI: `npm i -g discloud-cli`
2. Login: `discloud login`
3. Deploy: `discloud deploy .`
4. Monitor: `discloud logs`

---

## Phase 5: Connecting Services

### 5.1 Verify Supabase Connection
1. Open the dashboard URL in your browser
2. Sign in with Discord (OAuth2 flow)
3. Check that your guilds appear in the dashboard
4. Verify `dashboard_users` and `guild_members` rows were created in Supabase

### 5.2 Verify Bot → Supabase Sync
1. Check the `bot_status` table in Supabase:
   ```sql
   SELECT * FROM bot_status WHERE id = 1;
   ```
   - `online` should be `true`
   - `ping_ms` should show a number
   - `total_guilds` should match your bot's server count

2. Check `guild_configs`:
   ```sql
   SELECT guild_id, guild_name, target_voice_channel_id FROM guild_configs;
   ```
   Should show all guilds the bot is in.

### 5.3 Verify Dashboard → Bot Communication
1. In the dashboard, go to a guild's 24/7 Voice page
2. Click "Join Voice" and select a channel
3. Check `bot_commands` table:
   ```sql
   SELECT * FROM bot_commands WHERE status = 'pending' ORDER BY created_at DESC LIMIT 5;
   ```
   Should show a `join` command with the channel ID
4. The bot should poll, execute, and mark it as `completed`
5. Verify the bot actually joined the voice channel in Discord

### 5.4 Verify OAuth2 Flow
1. Sign out of the dashboard
2. Click "Sign in with Discord"
3. You should be redirected to Discord's authorization page
4. After authorizing, you should be redirected back to the dashboard
5. Your Discord username and avatar should appear in the navbar

---

## Phase 6: End-to-End Testing

### 6.1 Voice Control Test
- [ ] Join voice via dashboard → bot joins the channel
- [ ] Leave voice via dashboard → bot leaves
- [ ] Force leave via dashboard → bot disconnects and resets
- [ ] Bot auto-rejoins after ghost detection

### 6.2 Logging Test
- [ ] Set voice log channel via dashboard → bot logs voice events
- [ ] Set message log channel → bot logs message deletions/edits
- [ ] Set member log channel → bot logs joins/leaves

### 6.3 Welcome/Verify Test
- [ ] Set welcome channel → new member join sends welcome card
- [ ] Set leave channel → member leave sends leave card
- [ ] Set verify role + channel → verify button works

### 6.4 Streamer/Game Alerts Test
- [ ] Add a streamer subscription → bot monitors and posts when live
- [ ] Add a game subscription → bot posts when game goes free

### 6.5 Owner Panel Test
- [ ] Restart bot via owner panel → bot restarts
- [ ] Change presence via owner panel → bot presence updates
- [ ] View global stats → correct numbers shown
- [ ] Blacklist a server → bot leaves and won't rejoin

### 6.6 Feature Pages Test (UI Only — Bot Logic Pending)
- [ ] Auto-Mod: create/edit/delete rules → saves to Supabase
- [ ] Custom Commands: create/edit/delete commands → saves to Supabase
- [ ] Reaction Roles: create groups and emoji-role mappings → saves to Supabase
- [ ] Tickets: configure ticket system → saves to Supabase
- [ ] Webhooks: add/edit/delete webhooks → saves to Supabase

> **Note:** These 5 features have dashboard UI and Supabase tables but no bot-side logic yet. See INTEGRATION.md Section 4.2 for bot-side TODOs.

---

## Troubleshooting

### Bot not syncing to Supabase
- Check `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in bot's `.env`
- Check bot logs on Discloud: `discloud logs`
- Verify the sync module is loaded in `index.js`

### OAuth2 callback fails
- Verify `DISCORD_REDIRECT_URI` matches exactly (including https/http, trailing slash)
- Check `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET` are correct
- Check server logs for error messages

### Dashboard shows no data
- Verify Supabase env vars are set in the hosting environment
- Check browser console for Supabase connection errors
- Verify RLS policies allow authenticated users to read tables

### Bot commands not executing
- Check `bot_commands` table for pending commands
- Verify bot is polling the commands endpoint
- Check `BOT_API_TOKEN` matches between dashboard and bot
- Check bot logs for command execution errors
