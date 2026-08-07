import { NextRequest, NextResponse } from 'next/server';
import { requireGuildAdmin } from '@/lib/server-auth';
import { supabaseServer } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { guildId: string } }
) {
  const authResult = await requireGuildMember(req, params.guildId);
  if (authResult instanceof NextResponse) return authResult;

  const sb = supabaseServer();
  const { data, error } = await sb
    .from('guild_configs')
    .select('*')
    .eq('guild_id', params.guildId)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'Guild not found' }, { status: 404 });
  }
  return NextResponse.json(data);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { guildId: string } }
) {
  const authResult = await requireGuildAdmin(req, params.guildId);
  if (authResult instanceof NextResponse) return authResult;

  const body = await req.json().catch(() => ({}));
  const allowed: string[] = [
    'log_channels',
    'panel_channel_id',
    'panel_message_id',
    'welcome_channel_id',
    'leave_channel_id',
    'verify_role_id',
    'verify_channel_id',
    'verify_message_id',
    'bot_control_role_id',
    'target_voice_channel_id',
    'last_channel_id',
    'joined_at',
    'reconnect_count',
  ];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }
  updates.updated_at = new Date().toISOString();

  const sb = supabaseServer();
  const { data, error } = await sb
    .from('guild_configs')
    .update(updates)
    .eq('guild_id', params.guildId)
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

import { requireGuildMember } from '@/lib/server-auth';
