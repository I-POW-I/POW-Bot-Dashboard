import { NextRequest, NextResponse } from 'next/server';
import { requireGuildMember, requireGuildAdmin } from '@/lib/server-auth';
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
    .from('streamer_subscriptions')
    .select('*')
    .eq('guild_id', params.guildId)
    .order('created_at', { ascending: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { guildId: string } }
) {
  const authResult = await requireGuildAdmin(req, params.guildId);
  if (authResult instanceof NextResponse) return authResult;

  const body = await req.json().catch(() => ({}));
  const { platform, username, display_name, discord_channel_id, role_id } = body;
  if (!platform || !username || !discord_channel_id) {
    return NextResponse.json(
      { error: 'platform, username, discord_channel_id required' },
      { status: 400 }
    );
  }

  const sb = supabaseServer();
  const { data, error } = await sb
    .from('streamer_subscriptions')
    .insert({
      guild_id: params.guildId,
      platform,
      username,
      display_name: display_name || username,
      discord_channel_id,
      role_id: role_id || null,
      is_live: false,
    })
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
