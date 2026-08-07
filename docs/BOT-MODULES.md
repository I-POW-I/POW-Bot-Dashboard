# POW Bot — Feature Modules

These five modules add **automod, custom commands, reaction roles, tickets, and webhooks** to the 247-Pow-Bot. They read their configuration from the same Supabase database the dashboard writes to, so anything an admin configures in the dashboard takes effect in the bot automatically (within ~60 seconds, the cache TTL).

## What's inside

| File | Feature | Discord.js events used |
|------|---------|------------------------|
| `supabase-client.js` | Shared Supabase client (service-role key) | — |
| `automod.js` | Auto-moderation rules | `messageCreate` |
| `custom-commands.js` | Custom prefix commands | `messageCreate` |
| `reaction-roles.js` | Reaction role bindings | `messageReactionAdd`, `messageReactionRemove` |
| `tickets.js` | Ticket panel + open/close | `interactionCreate` (buttons), `ready` |
| `webhooks.js` | Webhook firing on events + HTTP trigger | `guildMemberAdd`, `guildMemberRemove`, HTTP |
| `index.js` | Wires all of the above onto the client | — |

## 1. Install the dependency

The bot already runs on Discloud. Add the Supabase client to its dependencies:

```bash
npm install @supabase/supabase-js
```

## 2. Copy the folder

Copy this entire `bot-modules/` folder into your `247-Pow-Bot` repo. A good spot is the repo root:

```
247-Pow-Bot/
├── src/
│   └── index.js
├── bot-modules/        ← copy everything here
│   ├── supabase-client.js
│   ├── automod.js
│   ├── custom-commands.js
│   ├── reaction-roles.js
│   ├── tickets.js
│   ├── webhooks.js
│   └── index.js
└── package.json
```

## 3. Wire it into your bot's entrypoint

In `src/index.js` (or wherever you construct your `Client`), require and register the modules **after** the client is created and **before** `client.login()`:

```js
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const botModules = require('../bot-modules');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,        // privileged — enable in Dev Portal
    GatewayIntentBits.GuildMembers,          // privileged — enable in Dev Portal
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildPresences,        // if you already use it
  ],
  partials: [Partials.Message, Partials.Reaction, Partials.Channel],
});

botModules.register(client);

client.login(process.env.TOKEN);
```

**Required privileged intents** (Discord Developer Portal → Bot → Privileged Gateway Intents):
- ✅ MESSAGE CONTENT (automod + custom commands need to read message text)
- ✅ SERVER MEMBERS (webhooks on member join/leave, ticket channel perms)

## 4. Bot environment variables (Discloud app config)

Add these to the bot's Discloud app env (the dashboard already uses the same Supabase project):

```
SUPABASE_URL=<same value as the dashboard>
SUPABASE_SERVICE_ROLE_KEY=<same value as the dashboard>
BOT_API_TOKEN=<shared secret — same value as the dashboard's BOT_API_TOKEN>
```

The service-role key bypasses RLS so the bot can read/write every guild's config. **Never ship this key in the dashboard's client-side code** — it only lives in the bot and in the dashboard's server-side API routes.

## 5. (Optional) Webhook HTTP trigger

If you want the dashboard's "Test webhook" button to fire through the bot instead of directly to Discord, run the tiny HTTP listener from `webhooks.js` somewhere in your bot process:

```js
const http = require('http');
const { handleHttpTrigger } = require('../bot-modules/webhooks');

const server = http.createServer((req, res) => {
  if (req.url?.startsWith('/webhooks/trigger')) return handleHttpTrigger(req, res);
  res.writeHead(404); res.end();
});
server.listen(process.env.BOT_HTTP_PORT || 8081);
```

This is optional — the dashboard's webhooks page already fires tests directly to the Discord webhook URL.

## 6. Keep the bot live

These modules are additive. They do **not** touch your existing voice/24-7 logic. The `messageCreate` handler calls automod then custom-commands; neither deletes or mutates voice state. If automod deletes a message, that's the only side effect. Your existing `ready` handler keeps running — `index.js` only adds an extra `ready` listener that ensures ticket panels exist.

## 7. How caching works

Every module caches guild config for 60 seconds to avoid hammering Supabase on every message. That means after an admin saves a change in the dashboard, it takes up to a minute to take effect in the bot. If you want instant updates, the dashboard can call a small invalidation endpoint — but the TTL is fine for nearly all cases.

## 8. Schema

The dashboard's Supabase project already has all the required tables (`automod_rules`, `custom_commands`, `reaction_role_groups`, `reaction_roles`, `ticket_configs`, `tickets`, `webhook_configs`). No extra DB setup is needed — just the env vars above.
