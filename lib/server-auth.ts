import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { OWNER_DISCORD_ID } from '@/lib/auth';
import type { GlobalRole, GuildMember } from '@/types';

export interface AuthenticatedUser {
  supabaseUserId: string;
  discordId: string;
  username: string;
  globalRole: GlobalRole;
  guilds: { guildId: string; role: GuildMember['role'] }[];
}

async function getUserFromRequest(req: NextRequest): Promise<AuthenticatedUser | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return null;
  const token = authHeader.replace('Bearer ', '');
  if (!token) return null;

  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser(token);
  if (!user) return null;

  const { data: du } = await sb
    .from('dashboard_users')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!du) return null;

  const { data: memberships } = await sb
    .from('guild_members')
    .select('guild_id, role')
    .eq('user_id', user.id);

  return {
    supabaseUserId: user.id,
    discordId: du.discord_id,
    username: du.username,
    globalRole: du.global_role as GlobalRole,
    guilds: (memberships || []).map((m: { guild_id: string; role: GuildMember['role'] }) => ({
      guildId: m.guild_id,
      role: m.role,
    })),
  };
}

type ErrorResponse = { error: string };

export function unauthorized(message = 'Unauthorized'): NextResponse<ErrorResponse> {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbidden(message = 'Forbidden'): NextResponse<ErrorResponse> {
  return NextResponse.json({ error: message }, { status: 403 });
}

export async function requireUser(req: NextRequest): Promise<AuthenticatedUser | NextResponse<ErrorResponse>> {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorized();
  return user;
}

export async function requireOwner(req: NextRequest): Promise<AuthenticatedUser | NextResponse<ErrorResponse>> {
  const result = await requireUser(req);
  if (result instanceof NextResponse) return result;
  if (result.globalRole !== 'owner') return forbidden('Owner access required');
  return result;
}

export async function requireGuildMember(
  req: NextRequest,
  guildId: string
): Promise<AuthenticatedUser | NextResponse<ErrorResponse>> {
  const result = await requireUser(req);
  if (result instanceof NextResponse) return result;
  const membership = result.guilds.find((g) => g.guildId === guildId);
  if (!membership) return forbidden('You are not a member of this server');
  return result;
}

export async function requireGuildAdmin(
  req: NextRequest,
  guildId: string
): Promise<AuthenticatedUser | NextResponse<ErrorResponse>> {
  const result = await requireGuildMember(req, guildId);
  if (result instanceof NextResponse) return result;
  const membership = result.guilds.find((g) => g.guildId === guildId);
  if (membership?.role !== 'owner' && membership?.role !== 'admin') {
    return forbidden('Admin access required for this server');
  }
  return result;
}

export function isOwnerUser(user: AuthenticatedUser): boolean {
  return user.discordId === OWNER_DISCORD_ID || user.globalRole === 'owner';
}
