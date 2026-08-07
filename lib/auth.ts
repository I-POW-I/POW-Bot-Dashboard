import { supabase } from '@/lib/supabase';
import type {
  AppRole,
  DashboardUser,
  GlobalRole,
  GuildMember,
  SessionUser,
} from '@/types';

export const OWNER_DISCORD_ID =
  process.env.NEXT_PUBLIC_OWNER_DISCORD_ID || '1928374650192837';
export const OWNER_DISCORD_USERNAME =
  process.env.NEXT_PUBLIC_OWNER_DISCORD_USERNAME || 'pow_owner';

const DEMO_GUILD_IDS = ['7381929384738291', '4829103847562019'];

const DEFAULT_AVATAR =
  'https://cdn.discordapp.com/embed/avatars/0.png';

function avatarUrl(discordId: string, avatar: string | null): string {
  if (!avatar) return DEFAULT_AVATAR;
  if (avatar.startsWith('http')) return avatar;
  const ext = avatar.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.${ext}`;
}

/**
 * Sign in a demo Discord user. In production this is replaced by the Discord
 * OAuth2 callback (see app/api/auth/callback/route.ts). Here we use Supabase
 * email/password auth with a deterministic email so the same demo identity
 * always maps to the same Supabase auth user.
 */
export async function signInDemoUser(opts?: {
  discordId?: string;
  username?: string;
  avatar?: string | null;
  globalName?: string | null;
}): Promise<SessionUser> {
  const discordId = opts?.discordId || OWNER_DISCORD_ID;
  const username = opts?.username || OWNER_DISCORD_USERNAME;
  const avatar = opts?.avatar ?? null;
  const globalName = opts?.globalName ?? username;

  const email = `${discordId}@powbot.local`;
  const password = `PowBot!${discordId}`;

  // Try sign-in first; fall back to sign-up.
  let { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    const signUp = await supabase.auth.signUp({ email, password });
    if (signUp.error) {
      throw new Error(`Auth failed: ${signUp.error.message}`);
    }
    const retry = await supabase.auth.signInWithPassword({ email, password });
    if (retry.error) {
      throw new Error(`Auth retry failed: ${retry.error.message}`);
    }
    data = retry.data;
  }

  const supabaseUid = data.user?.id;
  if (!supabaseUid) throw new Error('No supabase user id after auth');

  // Upsert dashboard_users row.
  const isOwner = discordId === OWNER_DISCORD_ID;
  const globalRole: GlobalRole = isOwner ? 'owner' : 'admin';

  const { error: upsertErr } = await supabase.from('dashboard_users').upsert(
    {
      user_id: supabaseUid,
      discord_id: discordId,
      username,
      global_name: globalName,
      avatar_url: avatarUrl(discordId, avatar),
      global_role: globalRole,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'discord_id' }
  );
  if (upsertErr) {
    console.warn('[auth] dashboard_users upsert failed', upsertErr.message);
  }

  // Seed guild_members for demo guilds.
  const memberRows = DEMO_GUILD_IDS.map((guildId) => ({
    user_id: supabaseUid,
    guild_id: guildId,
    role: (isOwner ? 'owner' : 'admin') as GuildMember['role'],
  }));
  await supabase
    .from('guild_members')
    .upsert(memberRows, { onConflict: 'user_id,guild_id', ignoreDuplicates: false });

  // Upsert app_users row (staff directory) — owner becomes super_admin.
  const appRole: AppRole = isOwner ? 'super_admin' : 'admin';
  const { data: appUserRow } = await supabase
    .from('app_users')
    .upsert(
      {
        user_id: supabaseUid,
        email,
        full_name: globalName || username,
        avatar_url: avatarUrl(discordId, avatar),
        role: appRole,
        status: 'active',
        last_active_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
    .select('id')
    .maybeSingle();

  // Ensure app_settings row exists for the user.
  await supabase.from('app_settings').upsert(
    { user_id: supabaseUid, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' }
  );

  // Seed a few welcome notifications if the user has none.
  const { count } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', supabaseUid);
  if (count === 0) {
    await supabase.from('notifications').insert([
      {
        user_id: supabaseUid,
        severity: 'success',
        category: 'system',
        title: 'Welcome to the POW Bot Dashboard',
        body: 'Your account is ready. Explore the 24/7 voice controls, streamer alerts, and the owner panel.',
        action_label: 'Open dashboard',
        action_url: '/dashboard',
      },
      {
        user_id: supabaseUid,
        severity: 'info',
        category: 'streamer',
        title: 'Streamer shroud went live',
        body: 'VALORANT Ranked Grind — posting to #stream-alerts in POW Lounge.',
        metadata: { guild_id: '7381929384738291', platform: 'twitch' },
      },
      {
        user_id: supabaseUid,
        severity: 'warning',
        category: 'voice',
        title: 'Ghost connection detected',
        body: 'Heartbeat auto-rejoined the bot to Lounge VC after a stalled connection.',
        metadata: { guild_id: '7381929384738291', channel: 'Lounge VC' },
      },
      {
        user_id: supabaseUid,
        severity: 'info',
        category: 'announcement',
        title: 'New bot release v4.0',
        body: 'Free-games alerts and improved voice logging are now available.',
      },
    ]);
  }

  return {
    discordId,
    username,
    globalName,
    avatarUrl: avatarUrl(discordId, avatar),
    globalRole,
    appRole,
    appUserId: appUserRow?.id ?? null,
    guilds: DEMO_GUILD_IDS.map((guildId) => ({
      guildId,
      role: isOwner ? 'owner' : 'admin',
    })),
  };
}

export async function getCurrentSessionUser(): Promise<SessionUser | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: du } = await supabase
    .from('dashboard_users')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle() as { data: DashboardUser | null };

  if (!du) return null;

  const { data: memberships } = await supabase
    .from('guild_members')
    .select('guild_id, role')
    .eq('user_id', user.id);

  const { data: appUser } = await supabase
    .from('app_users')
    .select('id, role')
    .eq('user_id', user.id)
    .maybeSingle() as { data: { id: string; role: AppRole } | null };

  return {
    discordId: du.discord_id,
    username: du.username,
    globalName: du.global_name,
    avatarUrl: du.avatar_url,
    globalRole: du.global_role,
    appRole: appUser?.role ?? 'viewer',
    appUserId: appUser?.id ?? null,
    guilds: (memberships || []).map((m: { guild_id: string; role: GuildMember['role'] }) => ({
      guildId: m.guild_id,
      role: m.role,
    })),
  };
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

export function canManageGuild(role: GuildMember['role'] | undefined): boolean {
  return role === 'owner' || role === 'admin' || role === 'moderator';
}

export function canAdminGuild(role: GuildMember['role'] | undefined): boolean {
  return role === 'owner' || role === 'admin';
}

export function isOwner(role: GlobalRole | undefined): boolean {
  return role === 'owner';
}

// ── App-level RBAC (staff management) ───────────────────────────────────────

export function isSuperAdmin(role: AppRole | undefined): boolean {
  return role === 'super_admin';
}

export function isAppAdmin(role: AppRole | undefined): boolean {
  return role === 'super_admin' || role === 'admin';
}

export function canEditContent(role: AppRole | undefined): boolean {
  return role === 'super_admin' || role === 'admin' || role === 'editor';
}

export function canManageUsers(role: AppRole | undefined): boolean {
  return role === 'super_admin' || role === 'admin';
}

export function canAccessSettings(role: AppRole | undefined): boolean {
  return role === 'super_admin' || role === 'admin';
}

export function canEditPermissions(role: AppRole | undefined): boolean {
  return role === 'super_admin';
}
