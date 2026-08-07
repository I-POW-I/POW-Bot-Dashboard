import { NextRequest, NextResponse } from 'next/server';
import { requireGuildAdmin } from '@/lib/server-auth';
import { supabaseServer } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

interface VoiceActionBody {
  action: 'join' | 'leave' | 'forceleave';
  channelId?: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { guildId: string } }
) {
  const authResult = await requireGuildAdmin(req, params.guildId);
  if (authResult instanceof NextResponse) return authResult;

  const body = (await req.json().catch(() => ({}))) as VoiceActionBody;
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.action === 'join') {
    if (!body.channelId) {
      return NextResponse.json({ error: 'channelId required for join' }, { status: 400 });
    }
    updates.target_voice_channel_id = body.channelId;
    updates.last_channel_id = body.channelId;
    updates.joined_at = new Date().toISOString();
  } else if (body.action === 'leave') {
    updates.target_voice_channel_id = null;
    updates.last_channel_id = null;
  } else if (body.action === 'forceleave') {
    updates.target_voice_channel_id = null;
    updates.last_channel_id = null;
    updates.joined_at = null;
    updates.reconnect_count = 0;
  } else {
    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  }

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

  try {
    await sb.from('bot_commands').insert({
      guild_id: params.guildId,
      command: body.action,
      payload: { channelId: body.channelId },
      status: 'pending',
    });
  } catch {
    // Non-fatal: bot will still see the updated guild_configs table
  }

  return NextResponse.json({ ok: true, config: data });
}
