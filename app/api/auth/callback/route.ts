import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseServer } from '@/lib/supabase';
import { OWNER_DISCORD_ID } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Use the public dashboard URL so redirects work behind a proxy/Discloud
function getBaseUrl(req: NextRequest): string {
  return (
    process.env.NEXT_PUBLIC_DASHBOARD_URL ||
    process.env.DISCORD_REDIRECT_URI?.replace('/api/auth/callback', '') ||
    `${req.headers.get('x-forwarded-proto') || 'https'}://${req.headers.get('host')}`
  );
}

const DISCORD_API = 'https://discord.com/api/v10';

interface DiscordTokenResponse {
  access_token: string;
  token_type: string;
  refresh_token?: string;
  scope: string;
}

interface DiscordUserResponse {
  id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
}

interface DiscordGuildResponse {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
}

function avatarUrl(discordId: string, avatar: string | null): string {
  if (!avatar) return 'https://cdn.discordapp.com/embed/avatars/0.png';
  const ext = avatar.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.${ext}`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  const cookieStore = cookies();
  const storedState = cookieStore.get('oauth_state')?.value;

  if (error) {
    return NextResponse.redirect(new URL(`/?error=${encodeURIComponent(error)}`, getBaseUrl(req)));
  }

  if (!code || !state || !storedState || state !== storedState) {
    return NextResponse.redirect(new URL('/?error=invalid_state', getBaseUrl(req)));
  }

  cookieStore.delete('oauth_state');

  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const redirectUri = process.env.DISCORD_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.redirect(new URL('/?error=oauth_not_configured', getBaseUrl(req)));
  }

  const tokenRes = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenRes.ok) {
    console.error('[oauth] token exchange failed', tokenRes.status);
    return NextResponse.redirect(new URL('/?error=token_exchange_failed', getBaseUrl(req)));
  }

  const tokenData = (await tokenRes.json()) as DiscordTokenResponse;
  const accessToken = tokenData.access_token;

  const userRes = await fetch(`${DISCORD_API}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!userRes.ok) {
    console.error('[oauth] user fetch failed', userRes.status);
    return NextResponse.redirect(new URL('/?error=user_fetch_failed', getBaseUrl(req)));
  }

  const discordUser = (await userRes.json()) as DiscordUserResponse;

  const guildsRes = await fetch(`${DISCORD_API}/users/@me/guilds`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  let userGuilds: DiscordGuildResponse[] = [];
  if (guildsRes.ok) {
    userGuilds = (await guildsRes.json()) as DiscordGuildResponse[];
  }

  const sb = supabaseServer();

  const email = `${discordUser.id}@powbot.local`;
  const password = crypto.randomUUID() + crypto.randomUUID();

  let supabaseUserId: string | null = null;

  const { data: existingUsers } = await sb.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (existingUsers) {
    const existing = existingUsers.users.find((u) => u.email === email);
    if (existing) supabaseUserId = existing.id;
  }

  if (!supabaseUserId) {
    const { data: newUser, error: createErr } = await sb.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createErr) {
      console.error('[oauth] failed to create supabase user', createErr.message);
      return NextResponse.redirect(new URL('/?error=user_creation_failed', getBaseUrl(req)));
    }
    supabaseUserId = newUser.user.id;
  }

  if (!supabaseUserId) {
    return NextResponse.redirect(new URL('/?error=no_user_id', getBaseUrl(req)));
  }

  const isOwner = discordUser.id === OWNER_DISCORD_ID;
  const globalRole = isOwner ? 'owner' : 'viewer';

  await sb.from('dashboard_users').upsert(
    {
      user_id: supabaseUserId,
      discord_id: discordUser.id,
      username: discordUser.username,
      global_name: discordUser.global_name,
      avatar_url: avatarUrl(discordUser.id, discordUser.avatar),
      global_role: globalRole,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'discord_id' }
  );

  const guildMemberRows = userGuilds.map((g) => ({
    user_id: supabaseUserId,
    guild_id: g.id,
    role: (g.owner ? 'owner' : 'viewer') as 'owner' | 'viewer',
  }));

  if (guildMemberRows.length > 0) {
    await sb.from('guild_members').upsert(guildMemberRows, {
      onConflict: 'user_id,guild_id',
      ignoreDuplicates: false,
    });
  }

  const ownedGuilds = userGuilds.filter((g) => g.owner);
  if (ownedGuilds.length > 0) {
    const configRows = ownedGuilds.map((g) => ({
      guild_id: g.id,
      guild_name: g.name,
      guild_icon: g.icon
        ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png`
        : null,
      joined_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
    await sb.from('guild_configs').upsert(configRows, {
      onConflict: 'guild_id',
      ignoreDuplicates: true,
    });
  }

  const appRole = isOwner ? 'super_admin' : 'viewer';
  await sb.from('app_users').upsert(
    {
      user_id: supabaseUserId,
      email,
      full_name: discordUser.global_name || discordUser.username,
      avatar_url: avatarUrl(discordUser.id, discordUser.avatar),
      role: appRole,
      status: 'active',
      last_active_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );

  await sb.from('app_settings').upsert(
    { user_id: supabaseUserId, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' }
  );

  const firstGuildId = userGuilds[0]?.id || '';
  const redirectUrl = firstGuildId ? `/dashboard/${firstGuildId}` : '/dashboard';
  const finalUrl = new URL(redirectUrl, getBaseUrl(req)).toString();

  // Generate a Supabase magic link so the browser gets a proper session.
  // The service role created the user but can't set browser cookies directly.
  // A magic link lets Supabase handle the session handoff cleanly.
  const { data: linkData, error: linkError } = await sb.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: finalUrl },
  });

  if (linkError || !linkData?.properties?.action_link) {
    console.error('[oauth] magic link generation failed', linkError?.message);
    // Fall back to a direct redirect — user may need to click "Open Dashboard"
    // which will use the demo sign-in flow as a fallback
    return NextResponse.redirect(new URL(finalUrl));
  }

  // Redirect to Supabase magic link → it sets session cookies → redirects to dashboard
  return NextResponse.redirect(linkData.properties.action_link);
}
