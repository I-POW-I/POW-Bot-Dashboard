# POW Bot Dashboard — Complete Setup Guide

> This guide walks you through everything, step by step. No technical knowledge
> needed. If you can copy-paste and click buttons, you can do this.

---

## Table of Contents

1. [What You're Building](#1-what-youre-building)
2. [What You Need Before Starting](#2-what-you-need-before-starting)
3. [Phase 1 — Testing (Safe, Nothing Breaks)](#phase-1--testing-safe-nothing-breaks)
4. [Phase 2 — Going Live](#phase-2--going-live)
5. [Troubleshooting](#troubleshooting)

---

## 1. What You're Building

You have two separate things that talk to each other:

```
  Dashboard (website)  ────writes settings────►  Supabase (database)  ◄────reads settings────  Bot (Discord bot)
```

- **Dashboard** — A website where you log in with Discord and configure your bot
- **Bot** — Your 24/7 POW Bot that stays in voice channels
- **Supabase** — A free database in the middle that both sides connect to

The dashboard saves settings to Supabase. The bot reads those settings from
Supabase. They never talk to each other directly.

---

## 2. What You Need Before Starting

Make sure you have these before you begin:

- [ ] A **GitHub account** (free at github.com)
- [ ] A **Discloud account** with **Gold tier or higher** (needed for website hosting)
- [ ] Your **Discord bot** already running on Discloud
- [ ] The **Discord Developer Portal** open (https://discord.com/developers/applications)
- [ ] This project folder downloaded to your computer

---

## Phase 1 — Testing (Safe, Nothing Breaks)

> In this phase, you'll put the dashboard on the internet in a test repo and make
> sure it works. Your existing bot stays completely untouched. Nothing can break.

### Step 1: Create a Test GitHub Repo for the Dashboard

1. Go to **github.com** and click the **+** icon in the top-right corner
2. Click **New repository**
3. Name it `pow-bot-dashboard-test`
4. Set it to **Private** (so only you can see it)
5. Check **Add a README file**
6. Click **Create repository**

### Step 2: Upload the Dashboard Code

1. Download this entire project folder to your computer if you haven't
2. Go to your new GitHub repo (`pow-bot-dashboard-test`)
3. Click **uploading an existing file** (near the "Or create new file" link)
4. Drag all the files from this project folder into the upload area
   - **IMPORTANT:** Do NOT upload the `.env` file — it has secrets
   - Upload everything else: all folders, all files
5. Add a commit message like "Initial dashboard upload"
6. Click **Commit changes**

> **What to upload:** Everything in the project folder. That includes:
> - `app/` folder
> - `components/` folder
> - `lib/` folder
> - `hooks/` folder
> - `types/` folder
> - `supabase/` folder
> - `bot-modules/` folder
> - `bot-integration/` folder
> - `docs/` folder
> - `public/` folder (if it exists)
> - `package.json`, `package-lock.json`, `next.config.js`, etc.
> - `.gitignore` (this IS safe to upload — it just tells GitHub what to ignore)
> - `.env.example` (this is safe — it has no real secrets, just placeholder text)

### Step 3: Create a Discloud Site App for the Dashboard

1. Log into **Discloud** (discloud.com)
2. Go to **My Apps**
3. Click **Create App** (or the + button)
4. Choose **Type: Site** (this is a website, not a bot)
5. Connect your GitHub repo `pow-bot-dashboard-test`
6. Set these settings:
   - **RAM:** 512MB
   - **Node version:** 20
   - **Build command:** `npm run build`
   - **Start command:** `npm run start`
7. Before deploying, you need to add environment variables (see Step 4)

### Step 4: Add Environment Variables to Discloud

In your Discloud app settings, find the **Environment Variables** section.
Add each of these:

> **Where to find Supabase values:** Log into your Supabase project dashboard
> (supabase.com). Go to **Settings → API**. You'll find the URL and keys there.
> Your Supabase project is already set up — the keys are in your `.env` file
> in this project folder. Copy them from there.

| Variable Name | Value | Where to Find It |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxxx.supabase.co` | Supabase → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (long string) | Supabase → Settings → API → anon public key |
| `SUPABASE_URL` | (same as above URL) | Same as above |
| `SUPABASE_ANON_KEY` | (same as above key) | Same as above |
| `SUPABASE_SERVICE_ROLE_KEY` | (long string) | Supabase → Settings → API → service_role key |
| `DISCORD_CLIENT_ID` | (your app's client ID) | Discord Developer Portal → your app → OAuth2 → Client ID |
| `DISCORD_CLIENT_SECRET` | (your app's secret) | Discord Developer Portal → your app → OAuth2 → Client Secret |
| `DISCORD_REDIRECT_URI` | `https://your-dashboard-url.discloud.app/api/auth/callback` | Replace with your actual Discloud URL |
| `NEXT_PUBLIC_USE_DISCORD_OAUTH` | `true` | This enables real Discord login |
| `NEXT_PUBLIC_DASHBOARD_URL` | `https://your-dashboard-url.discloud.app` | Your Discloud site URL |
| `NEXT_PUBLIC_OWNER_DISCORD_ID` | (your Discord user ID) | See below for how to find this |
| `NEXT_PUBLIC_OWNER_DISCORD_USERNAME` | (your Discord username) | Your Discord username |
| `NEXT_PUBLIC_BOT_INVITE_URL` | (your bot invite link) | Discord Developer Portal → OAuth2 → URL Generator |
| `BOT_API_TOKEN` | (make up a random secret) | Type 32+ random characters — you'll use this same value on the bot later |
| `DISCLOUD_SITE` | `true` | Tells the dashboard to listen on port 8080 |

> **How to find your Discord user ID:**
> 1. Open Discord settings → Advanced → Enable **Developer Mode**
> 2. Right-click your own username in Discord
> 3. Click **Copy ID**
> 4. That number is your Discord user ID

### Step 5: Set Up Discord OAuth2 Redirect

1. Go to **Discord Developer Portal** → your application
2. Click **OAuth2** in the left sidebar
3. In **Redirects**, add this URL:
   ```
   https://your-dashboard-url.discloud.app/api/auth/callback
   ```
   (replace `your-dashboard-url` with your actual Discloud URL)
4. Also add `http://localhost:3000/api/auth/callback` for local testing
5. Click **Save Changes**

### Step 6: Deploy and Test the Dashboard

1. In Discloud, click **Deploy** (or **Restart**) on your dashboard app
2. Wait for the build to finish (watch the logs — it takes 1-3 minutes)
3. Once it says "online", click the URL to open your dashboard
4. You should see a login page — click **Sign in with Discord**
5. Authorize with Discord
6. You should see the dashboard with your server listed

**Test these things:**
- [ ] You can log in with Discord
- [ ] You can see your server(s) in the list
- [ ] You can click into a server and see the dashboard pages
- [ ] You can navigate to Automod, Custom Commands, Reaction Roles, etc.
- [ ] Settings you save appear when you refresh the page

**What's NOT working yet:** The bot won't react to any settings you save.
That's expected — the bot isn't connected to Supabase yet. That's Phase 2.

### Step 7: Test the Bot Integration (Optional, Still Safe)

If you want to test the bot side without touching your live bot:

1. Create a second GitHub repo called `pow-bot-test` (for the bot)
2. Clone your real bot repo into it (or download your bot code)
3. Follow the guide in `docs/BOT-INTEGRATION.md` — it tells you exactly which
   files to copy from the `bot-integration/` folder and how to modify your bot
4. Create a second Discloud app with **Type: Bot**
5. Add the bot environment variables (see `bot-integration/.env.example`)
6. Deploy and test

> **Safe testing tip:** Use a test Discord server (create a new one in Discord)
> so your real server is completely unaffected. Invite your bot to the test
> server and try the dashboard features there.

---

## Phase 2 — Going Live

> Only do this after Phase 1 works perfectly. In this phase, you connect your
> REAL bot to the dashboard so settings actually take effect.

### Step 1: Update Your Real Bot's Code

1. Download your real bot repo from GitHub (the one your live Discloud bot uses)
2. Copy the `bot-modules/` folder from this project into your bot repo root
3. Copy `bot-integration/index.js` into your bot repo, replacing the existing `index.js`
4. Copy `bot-integration/src/client.js` into your bot's `src/` folder, replacing `src/client.js`
5. Copy `bot-integration/package.json` into your bot repo, replacing `package.json`
6. Open `bot-integration/.env.example` — you need those new env vars on your bot

> **Before you push:** Test locally first! Run `npm install` then `npm start` in
> your bot repo. Make sure the bot starts and you see:
> ```
> [INFO] Dashboard feature modules registered
> ```

### Step 2: Enable Discord Intents

1. Go to **Discord Developer Portal** → your app → **Bot**
2. Scroll down to **Privileged Gateway Intents**
3. Enable ALL three:
   - [x] PRESENCE INTENT
   - [x] SERVER MEMBERS INTENT
   - [x] MESSAGE CONTENT INTENT
4. Click **Save Changes**

### Step 3: Add Env Vars to Your Real Discloud Bot App

In your **existing** Discloud bot app, add these environment variables:

| Variable Name | Value |
|---|---|
| `SUPABASE_URL` | (same Supabase URL as the dashboard) |
| `SUPABASE_SERVICE_ROLE_KEY` | (same service role key as the dashboard) |
| `BOT_API_TOKEN` | (same shared secret you set on the dashboard) |

### Step 4: Push and Deploy

1. Push your updated bot repo to GitHub
2. In Discloud, restart your bot app
3. Watch the logs — you should see:
   ```
   [INFO] Dashboard feature modules registered
   ```
4. If you see the warning about missing env vars, check that you added them correctly

### Step 5: Full End-to-End Test

1. Open your dashboard URL
2. Sign in with Discord
3. Select your real server
4. Go to **Automod** and add a simple rule (e.g., block the word "testbadword")
5. Go to your Discord server and type "testbadword"
6. The bot should delete the message within 60 seconds
7. If it works — congratulations, the full system is live!

### Step 6: Clean Up Test Apps

Once everything works:
1. Delete your test GitHub repos (or keep them as backups)
2. Delete your test Discloud apps
3. Update your dashboard repo from `pow-bot-dashboard-test` to `pow-bot-dashboard`
   (or just keep the test name — it doesn't matter)

---

## Troubleshooting

### Dashboard won't load (blank page or error)

- Check Discloud logs for build errors
- Make sure all environment variables are set correctly
- Make sure `DISCLOUD_SITE=true` is set
- Try redeploying

### Can't log in with Discord

- Check that `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET` are correct
- Check that the redirect URI in Discord Developer Portal matches your Discloud URL exactly
- The URL must end with `/api/auth/callback` — no trailing slash
- Make sure `NEXT_PUBLIC_USE_DISCORD_OAUTH=true`

### Dashboard loads but no servers appear

- Make sure you're logged into the Discord account that owns/manages the server
- The bot must be invited to the server for it to appear in some cases
- Check Supabase → Table Editor → `guild_members` — your user should have rows

### Bot doesn't react to dashboard settings

- Check the bot logs for `[INFO] Dashboard feature modules registered`
- If you see the warning instead, check `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` on the bot
- Make sure the bot has the right permissions in your Discord server (Manage Roles, Manage Channels, etc.)
- The bot polls Supabase every 60 seconds — settings may take up to a minute to take effect

### Reaction roles don't work

- Enable **SERVER MEMBERS INTENT** in Discord Developer Portal
- Make sure the bot's role is ABOVE the role it's trying to assign (drag it up in Server Settings → Roles)
- Make sure the bot has **Manage Roles** permission

### "Unauthorized" or "Forbidden" errors on the dashboard

- This means the security system is working — you're being blocked from accessing something
- Make sure you're logged in
- Make sure you're an admin/owner of the server you're trying to access
- If you're the owner and still get blocked, check that `NEXT_PUBLIC_OWNER_DISCORD_ID` matches your Discord ID

### Need more help?

Check the other guides in the `docs/` folder:
- `docs/BOT-INTEGRATION.md` — detailed bot integration instructions
- `docs/BOT-MODULES.md` — what each bot module does
- `docs/DEPLOYMENT.md` — Discloud deployment details
