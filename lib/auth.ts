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

const DEFAULT_AVATAR = 'https://cdn.discordapp.com/embed/avatars/0.png';

function avatarUrl(discordId: string, avatar: string | null): string {
  if (!avatar) return DEFAULT_AVATAR;
  if (avatar.startsWith('http')) return avatar;
  const ext = avatar.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.${ext}`;
}

export async function signInDemoUser(opts?: {
  discordId?: string;
  username?: string;
  avatar?: string | null;
  globalName?: string | null;
}): Promise<SessionUser> {
  const discordId = opts?.discordId || OWNER_DISCORD_ID;
  const username  = opts?.username  || OWNER_DISCORD_USERNAME;
  const avatar    = opts?.avatar ?? null;
  const globalName = opts?.globalName ?? username;

  const email    = `${discordId}@powbot.local`;
  const password = `PowBot!${discordId}`;

  let { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const signUp = await supabase.auth.signUp({ email, password });
    if (signUp.error) throw new Error(`Auth failed: ${signUp.error.message}`);
    const retry = await supabase.auth.signInWithPassword({ email, password });
    if (retry.error) throw new Error(`Auth retry failed: ${retry.error.message}`);
    data = retry.data;
  }

  const supabaseUid = data.user?.id;
  if (!supabaseUid) throw new Error('No supabase user id after auth');

  const isOwner: boolean   = discordId === OWNER_DISCORD_ID;
  const globalRole: GlobalRole = isOwner ? 'owner' : 'admin';

  const { error: upsertErr } = await supabase.from('dashboard_users').upsert(
    {
      user_id:      supabaseUid,
      discord_id:   discordId,
      username,
      global_name:  globalName,
      avatar_url:   avatarUrl(discordId, avatar),
      global_role:  globalRole,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'discord_id' }
  );
  if (upsertErr) console.warn('[auth] dashboard_users upsert failed', upsertErr.message);

  const memberRows = DEMO_GUILD_IDS.map((guildId) => ({
    user_id:  supabaseUid,
    guild_id: guildId,
    role:     (isOwner ? 'owner' : 'admin') as GuildMember['role'],
  }));
  await supabase.from('guild_members').upsert(memberRows, { onConflict: 'user_id,guild_id', ignoreDuplicates: false });

  const appRole: AppRole = isOwner ? 'super_admin' : 'admin';
  const { data: appUserRow } = await supabase
    .from('app_users')
    .upsert(
      {
        user_id:        supabaseUid,
        email,
        full_name:      globalName || username,
        avatar_url:     avatarUrl(discordId, avatar),
        role:           appRole,
        status:         'active',
        last_active_at: new Date().toISOString(),
        updated_at:     new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
    .select('id')
    .maybeSingle();

  await supabase.from('app_settings').upsert(
    { user_id: supabaseUid, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' }
  );

  const { count } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', supabaseUid);
  if (count === 0) {
    await supabase.from('notifications').insert([
      {
        user_id:      supabaseUid,
        severity:     'success',
        category:     'system',
        title:        'Welcome to the POW Bot Dashboard',
        body:         'Your account is ready. Explore the 24/7 voice controls, streamer alerts, and the owner panel.',
        action_label: 'Open dashboard',
        action_url:   '/dashboard',
      },
    ]);
  }

  return {
    discordId,
    username,
    globalName,
    avatarUrl:   avatarUrl(discordId, avatar),
    globalRole,
    appRole,
    appUserId:   appUserRow?.id ?? null,
    guilds: DEMO_GUILD_IDS.map((guildId) => ({
      guildId,
      role: isOwner ? 'owner' : 'admin',
    })),
  };
}

export async function getCurrentSessionUser(): Promise<SessionUser | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: du } = await supabase
    .from('dashboard_users')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle() as { data: DashboardUser | null };

  // If the DB row doesn't exist yet (e.g. server-side upsert failed due to
  // permissions), build a fallback SessionUser from the Supabase auth metadata
  // so the user is not bounced back to the home page.
  if (!du) {
    const meta       = (user.user_metadata || {}) as Record<string, string>;
    const discordId  = meta['discord_id'] || meta['provider_id'] || user.id;
    const username   = meta['username']   || meta['full_name']    || 'User';
    const isOwner    = discordId === OWNER_DISCORD_ID;
    const globalRole: GlobalRole = isOwner ? 'owner' : 'admin';

    // Attempt to create the missing row client-side as a recovery step
    supabase.from('dashboard_users').upsert(
      {
        user_id:      user.id,
        discord_id:   discordId,
        username,
        global_name:  meta['global_name'] || username,
        avatar_url:   meta['avatar_url']  || DEFAULT_AVATAR,
        global_role:  globalRole,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'discord_id' }
    ).then(({ error }) => {
      if (error) console.warn('[auth] recovery upsert failed', error.message);
    });

    return {
      discordId,
      username,
      globalName:  meta['global_name'] || username,
      avatarUrl:   meta['avatar_url']  || DEFAULT_AVATAR,
      globalRole,
      appRole:     isOwner ? 'super_admin' : 'admin',
      appUserId:   null,
      guilds:      [],
    };
  }

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
    discordId:  du.discord_id,
    username:   du.username,
    globalName: du.global_name,
    avatarUrl:  du.avatar_url,
    globalRole: du.global_role,
    appRole:    appUser?.role ?? 'viewer',
    appUserId:  appUser?.id ?? null,
    guilds: (memberships || []).map((m: { guild_id: string; role: GuildMember['role'] }) => ({
      guildId: m.guild_id,
      role:    m.role,
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
